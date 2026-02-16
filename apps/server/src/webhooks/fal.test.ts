import type http from "node:http";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import pino from "pino";

import { createFalWebhookHandler, _resetJwksCache } from "./fal";

// Mock libsodium-wrappers
mock.module("libsodium-wrappers", () => ({
  __esModule: true,
  default: {
    ready: Promise.resolve(),
    crypto_sign_verify_detached: mock(() => true),
  },
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
    const origVerify = sodium.crypto_sign_verify_detached;
    sodium.crypto_sign_verify_detached = mock(() => false) as typeof origVerify;

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

    // Restore
    sodium.crypto_sign_verify_detached = origVerify;
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
        images: [{ url: "https://cdn.fal.media/result.png", content_type: "image/png", width: 864, height: 1296 }],
      },
    });

    const req = createMockRequest(payload);
    const res = createMockResponse();

    await handler(req, res);

    expect(res._statusCode).toBe(200);
    expect(imageStorage.saveRenderResult).not.toHaveBeenCalled();
  });
});
