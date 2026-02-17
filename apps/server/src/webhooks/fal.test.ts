import { createHash } from "node:crypto";
import type http from "node:http";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import pino from "pino";

import type { db as _dbType } from "@acme/db/client";

import { _resetJwksCache, createFalWebhookHandler } from "./fal";

// Mock libsodium-wrappers
mock.module("libsodium-wrappers", () => ({
  __esModule: true,
  default: {
    ready: Promise.resolve(),
    crypto_sign_verify_detached: mock(() => true),
  },
}));

// Mock creditService — track consumeCredit calls
const mockConsumeCredit = mock(() =>
  Promise.resolve({ success: true, remaining: 2 }),
);
mock.module("@acme/api/services/creditService", () => ({
  createCreditService: mock(() => ({
    consumeCredit: mockConsumeCredit,
  })),
}));

const logger = pino({ level: "silent" });

function createMockDb(renderRecord?: {
  id: string;
  userId: string;
  status: string;
}) {
  const selectChain: Record<string, unknown> = {};
  const methods = ["select", "from", "where", "limit"];
  for (const method of methods) {
    selectChain[method] = mock(() => selectChain);
  }
  selectChain.then = mock((...args: unknown[]) => {
    const resolve = args[0] as (val: unknown[]) => void;
    return resolve(renderRecord ? [renderRecord] : []);
  });

  const updateChain: Record<string, unknown> = {};
  updateChain.set = mock(() => updateChain);
  updateChain.where = mock(() => updateChain);
  updateChain.then = mock((...args: unknown[]) => {
    const resolve = args[0] as (val: unknown) => void;
    return resolve(undefined);
  });

  return {
    select: mock(() => selectChain),
    update: mock(() => updateChain),
    _selectChain: selectChain,
    _updateChain: updateChain,
  } as unknown as typeof _dbType & {
    _selectChain: typeof selectChain;
    _updateChain: typeof updateChain;
  };
}

function createMockImageStorage() {
  return {
    saveRenderResult: mock(() =>
      Promise.resolve("user-123/renders/render-abc_result.png"),
    ),
  };
}

const VALID_TIMESTAMP = String(Math.floor(Date.now() / 1000));

function createMockRequest(
  body: string,
  headers: Record<string, string> = {},
): http.IncomingMessage {
  const defaultHeaders = {
    "x-fal-webhook-request-id": "fal-req-123",
    "x-fal-webhook-user-id": "fal-user-456",
    "x-fal-webhook-timestamp": VALID_TIMESTAMP,
    "x-fal-webhook-signature": "valid-sig-hex",
    ...headers,
  };

  const chunks = [Buffer.from(body)];
  let chunkIndex = 0;

  return {
    headers: defaultHeaders,
    [Symbol.asyncIterator]: () => ({
      next: () => {
        if (chunkIndex < chunks.length) {
          return Promise.resolve({
            value: chunks[chunkIndex++],
            done: false,
          });
        }
        return Promise.resolve({ value: undefined, done: true });
      },
    }),
  } as unknown as http.IncomingMessage;
}

function createMockResponse(): http.ServerResponse & {
  _statusCode: number;
  _body: string;
  _headers: Record<string, string>;
} {
  const res = {
    _statusCode: 200,
    _body: "",
    _headers: {} as Record<string, string>,
    writeHead: mock(function (
      this: { _statusCode: number; _headers: Record<string, string> },
      statusCode: number,
      headers?: Record<string, string>,
    ) {
      this._statusCode = statusCode;
      if (headers) Object.assign(this._headers, headers);
    }),
    end: mock(function (this: { _body: string }, body?: string) {
      if (body) this._body = body;
    }),
  };
  return res as unknown as http.ServerResponse & {
    _statusCode: number;
    _body: string;
    _headers: Record<string, string>;
  };
}

// Mock global fetch for JWKS + image download
const originalFetch = globalThis.fetch;

beforeEach(() => {
  _resetJwksCache();
  mockConsumeCredit.mockClear();
  globalThis.fetch = mock((url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr.includes("jwks.json")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            keys: [{ x: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }],
          }),
      } as unknown as Response);
    }
    // Image download
    return Promise.resolve({
      ok: true,
      headers: new Headers({ "content-length": "10" }),
      arrayBuffer: () => Promise.resolve(Buffer.from("image-data")),
    } as unknown as Response);
  }) as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fal webhook handler", () => {
  test("valid signature → processes render completion", async () => {
    const db = createMockDb({
      id: "render-abc",
      userId: "user-123",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "OK",
      payload: {
        images: [
          {
            url: "https://cdn.fal.media/result.png",
            content_type: "image/png",
            width: 864,
            height: 1296,
          },
        ],
      },
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(imageStorage.saveRenderResult).toHaveBeenCalled();
  });

  test("invalid signature → returns 401", async () => {
    // Override sodium mock for this test
    const sodium = (await import("libsodium-wrappers")).default;
    const original = sodium.crypto_sign_verify_detached;
    sodium.crypto_sign_verify_detached = mock(() => false);

    const db = createMockDb();
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "OK",
    });
    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(401);

    sodium.crypto_sign_verify_detached = original;
  });

  test("expired timestamp (>5 min) → returns 401", async () => {
    const db = createMockDb();
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const expiredTimestamp = String(Math.floor(Date.now() / 1000) - 400); // 400s ago
    const payload = JSON.stringify({ request_id: "fal-req-123", status: "OK" });
    const req = createMockRequest(payload, {
      "x-fal-webhook-timestamp": expiredTimestamp,
    });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(401);
  });

  test("completed render → downloads image, stores to disk, updates DB", async () => {
    const db = createMockDb({
      id: "render-abc",
      userId: "user-123",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "OK",
      payload: {
        images: [
          {
            url: "https://cdn.fal.media/result.png",
            content_type: "image/png",
            width: 864,
            height: 1296,
          },
        ],
      },
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(imageStorage.saveRenderResult).toHaveBeenCalledWith(
      "user-123",
      "render-abc",
      expect.any(Buffer),
      "image/png",
    );
    expect(db.update).toHaveBeenCalled();
    // Verify creditConsumed is set to true on completion
    expect(db._updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", creditConsumed: true }),
    );
  });

  test("completed render sets creditConsumed = true", async () => {
    const db = createMockDb({
      id: "render-xyz",
      userId: "user-456",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "OK",
      payload: {
        images: [
          {
            url: "https://cdn.fal.media/result2.png",
            content_type: "image/png",
            width: 864,
            height: 1296,
          },
        ],
      },
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();
    await handler(req, res);

    expect(db._updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ creditConsumed: true }),
    );
  });

  test("failed render does NOT set creditConsumed = true", async () => {
    const db = createMockDb({
      id: "render-abc",
      userId: "user-123",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "ERROR",
      error: "Something went wrong",
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();
    await handler(req, res);

    // Should set status to failed but NOT creditConsumed: true
    expect(db._updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorCode: "RENDER_FAILED" }),
    );
    // Verify creditConsumed was NOT included in the set call
    const setCallArgs = (db._updateChain.set as ReturnType<typeof mock>).mock
      .calls[0] as [Record<string, unknown>];
    expect(setCallArgs[0]).not.toHaveProperty("creditConsumed");
  });

  test("failed render → updates DB with error, does not download", async () => {
    const db = createMockDb({
      id: "render-abc",
      userId: "user-123",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "ERROR",
      error: "Invalid image",
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(imageStorage.saveRenderResult).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  test("malformed JSON body → returns 400", async () => {
    const db = createMockDb();
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const req = createMockRequest("not-json{{{");
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(400);
    expect(JSON.parse(res._body)).toEqual({ error: "Invalid JSON body" });
  });

  test("idempotent — already completed render → no-op, returns 200", async () => {
    const db = createMockDb({
      id: "render-abc",
      userId: "user-123",
      status: "completed",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "OK",
      payload: {
        images: [
          {
            url: "https://cdn.fal.media/result.png",
            content_type: "image/png",
            width: 864,
            height: 1296,
          },
        ],
      },
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(imageStorage.saveRenderResult).not.toHaveBeenCalled();
  });

  test("completed render calls creditService.consumeCredit", async () => {
    const db = createMockDb({
      id: "render-credit",
      userId: "user-credit-123",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "OK",
      payload: {
        images: [
          {
            url: "https://cdn.fal.media/result.png",
            content_type: "image/png",
            width: 864,
            height: 1296,
          },
        ],
      },
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(mockConsumeCredit).toHaveBeenCalledWith("user-credit-123");
  });

  test("failed render does NOT call creditService.consumeCredit", async () => {
    const db = createMockDb({
      id: "render-abc",
      userId: "user-123",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "ERROR",
      error: "Something went wrong",
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();
    await handler(req, res);

    expect(mockConsumeCredit).not.toHaveBeenCalled();
  });

  test("SSRF protection — blocks non-fal.media image URLs", async () => {
    const db = createMockDb({
      id: "render-abc",
      userId: "user-123",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "OK",
      payload: {
        images: [
          {
            url: "https://evil.com/steal.png",
            content_type: "image/png",
            width: 864,
            height: 1296,
          },
        ],
      },
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(imageStorage.saveRenderResult).not.toHaveBeenCalled();
    // Render should be marked as failed
    expect(db._updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorCode: "RENDER_FAILED" }),
    );
  });

  test("SSRF protection — blocks HTTP URLs (requires HTTPS)", async () => {
    const db = createMockDb({
      id: "render-abc",
      userId: "user-123",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "OK",
      payload: {
        images: [
          {
            url: "http://cdn.fal.media/result.png",
            content_type: "image/png",
            width: 864,
            height: 1296,
          },
        ],
      },
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(imageStorage.saveRenderResult).not.toHaveBeenCalled();
    expect(db._updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorCode: "RENDER_FAILED" }),
    );
  });

  test("SSRF protection — blocks localhost URLs", async () => {
    const db = createMockDb({
      id: "render-abc",
      userId: "user-123",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "OK",
      payload: {
        images: [
          {
            url: "https://localhost/internal",
            content_type: "image/png",
            width: 864,
            height: 1296,
          },
        ],
      },
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(imageStorage.saveRenderResult).not.toHaveBeenCalled();
    expect(db._updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorCode: "RENDER_FAILED" }),
    );
  });

  test("SSRF protection — allows valid fal.media subdomain URLs", async () => {
    const db = createMockDb({
      id: "render-abc",
      userId: "user-123",
      status: "processing",
    });
    const imageStorage = createMockImageStorage();
    const handler = createFalWebhookHandler({ db, imageStorage, logger });

    const payload = JSON.stringify({
      request_id: "fal-req-123",
      status: "OK",
      payload: {
        images: [
          {
            url: "https://cdn.fal.media/result.png",
            content_type: "image/png",
            width: 864,
            height: 1296,
          },
        ],
      },
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(imageStorage.saveRenderResult).toHaveBeenCalled();
  });
});
