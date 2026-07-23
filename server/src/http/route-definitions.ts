import { createRoute, z } from "@hono/zod-openapi";
import {
  categorySchema,
  errorSchema,
  garmentInputSchema,
  idSchema,
  lookSchema,
  renderSchema,
  standardErrors,
} from "./schemas";

const appAttestHeaders = z.object({
  "x-app-attest-challenge": z.string().optional(),
  "x-app-attest-key-id": z.string().optional(),
  "x-app-attest-assertion": z.string().optional(),
  "x-app-attest-unsupported": z.string().optional(),
});

export const attestChallengeRoute = createRoute({
  operationId: "getAttestChallenge",
  method: "get",
  path: "/attest/challenge",
  tags: ["Integrity"],
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ challenge: z.string().uuid() }) } },
      description: "One-time App Attest challenge",
    },
    ...standardErrors,
  },
});

export const attestVerifyRoute = createRoute({
  operationId: "verifyAppAttest",
  method: "post",
  path: "/attest/verify",
  tags: ["Integrity"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            challenge: z.string().uuid(),
            keyId: z.string().min(10),
            attestation: z.string().min(20),
          }),
        },
      },
    },
  },
  responses: { 204: { description: "App Attest key enrolled" }, ...standardErrors },
});

export const uploadRoute = createRoute({
  operationId: "uploadImage",
  method: "post",
  path: "/uploads",
  tags: ["Images"],
  request: {
    headers: appAttestHeaders,
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({
            image: z.custom<File>((value) => value instanceof File).openapi({ type: "string", format: "binary" }),
            purpose: z.enum(["garment", "reference"]),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({
            id: idSchema,
            contentType: z.string(),
            width: z.number().nullable(),
            height: z.number().nullable(),
          }),
        },
      },
      description: "Private image stored",
    },
    ...standardErrors,
    422: { content: { "application/json": { schema: errorSchema } }, description: "Invalid upload" },
  },
});

export const detectRoute = createRoute({
  operationId: "detectGarment",
  method: "post",
  path: "/garments/detect",
  tags: ["Garments"],
  request: { body: { content: { "application/json": { schema: z.object({ assetId: idSchema }) } } } },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            category: categorySchema,
            confidence: z.number(),
            requiresConfirmation: z.boolean(),
            model: z.string(),
          }),
        },
      },
      description: "Garment category suggestion",
    },
    404: { content: { "application/json": { schema: errorSchema } }, description: "Asset not found" },
    ...standardErrors,
  },
});

export const saveGarmentRoute = createRoute({
  operationId: "upsertGarment",
  method: "put",
  path: "/garments/{id}",
  tags: ["Garments"],
  request: {
    params: z.object({ id: idSchema }),
    body: {
      content: {
        "application/json": {
          schema: z.object({ name: z.string().min(1).max(100), category: categorySchema, assetId: idSchema }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ id: idSchema, name: z.string(), category: categorySchema, assetId: idSchema }),
        },
      },
      description: "Saved garment",
    },
    404: { content: { "application/json": { schema: errorSchema } }, description: "Asset not found" },
    ...standardErrors,
  },
});

export const deleteGarmentRoute = createRoute({
  operationId: "deleteGarment",
  method: "delete",
  path: "/garments/{id}",
  tags: ["Garments"],
  request: { params: z.object({ id: idSchema }) },
  responses: { 204: { description: "Garment and its private source image deleted idempotently" }, ...standardErrors },
});

export const saveReferenceRoute = createRoute({
  operationId: "upsertReference",
  method: "put",
  path: "/references/{id}",
  tags: ["Images"],
  request: {
    params: z.object({ id: idSchema }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            assetId: idSchema,
            isDefault: z.boolean().default(false),
            generatedFromVariantId: idSchema.optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ id: idSchema, assetId: idSchema, isDefault: z.boolean() }) },
      },
      description: "Saved private reference",
    },
    404: { content: { "application/json": { schema: errorSchema } }, description: "Asset not found" },
    ...standardErrors,
  },
});

export const deleteReferenceRoute = createRoute({
  operationId: "deleteReference",
  method: "delete",
  path: "/references/{id}",
  tags: ["Images"],
  request: { params: z.object({ id: idSchema }) },
  responses: { 204: { description: "Reference image deleted idempotently" }, ...standardErrors },
});

export const saveLookRoute = createRoute({
  operationId: "upsertLook",
  method: "put",
  path: "/looks/{id}",
  tags: ["Looks"],
  request: {
    params: z.object({ id: idSchema }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1).max(100),
            note: z.string().max(1000).default(""),
            garments: z.array(garmentInputSchema).min(1).max(3),
          }),
        },
      },
    },
  },
  responses: {
    200: { content: { "application/json": { schema: lookSchema } }, description: "Saved editable look" },
    404: { content: { "application/json": { schema: errorSchema } }, description: "Garment not found" },
    ...standardErrors,
  },
});

export const deleteLookRoute = createRoute({
  operationId: "deleteLook",
  method: "delete",
  path: "/looks/{id}",
  tags: ["Looks"],
  request: { params: z.object({ id: idSchema }) },
  responses: {
    204: { description: "Look, variants, and generated result files deleted idempotently" },
    ...standardErrors,
  },
});

export const createRenderRoute = createRoute({
  operationId: "createRender",
  method: "post",
  path: "/renders",
  tags: ["Renders"],
  request: {
    headers: appAttestHeaders.extend({ "idempotency-key": z.string().min(8).max(200) }),
    body: {
      content: {
        "application/json": { schema: z.object({ renderId: idSchema, lookId: idSchema, referencePhotoId: idSchema }) },
      },
    },
  },
  responses: {
    202: { content: { "application/json": { schema: renderSchema } }, description: "Render queued" },
    404: { content: { "application/json": { schema: errorSchema } }, description: "Look or reference not found" },
    409: { content: { "application/json": { schema: errorSchema } }, description: "Idempotency conflict" },
    429: { content: { "application/json": { schema: errorSchema } }, description: "Allowance exhausted" },
    ...standardErrors,
  },
});

export const getRenderRoute = createRoute({
  operationId: "getRender",
  method: "get",
  path: "/renders/{id}",
  tags: ["Renders"],
  request: { params: z.object({ id: idSchema }) },
  responses: {
    200: { content: { "application/json": { schema: renderSchema } }, description: "Immutable render variant" },
    404: { content: { "application/json": { schema: errorSchema } }, description: "Not found" },
    ...standardErrors,
  },
});

export const deleteRenderRoute = createRoute({
  operationId: "deleteRender",
  method: "delete",
  path: "/renders/{id}",
  tags: ["Renders"],
  request: { params: z.object({ id: idSchema }) },
  responses: {
    204: { description: "Render variant and its private result file deleted idempotently" },
    409: { content: { "application/json": { schema: errorSchema } }, description: "Render is still in progress" },
    ...standardErrors,
  },
});

export const feedbackRoute = createRoute({
  operationId: "submitRenderFeedback",
  method: "post",
  path: "/renders/{id}/feedback",
  tags: ["Renders"],
  request: {
    params: z.object({ id: idSchema }),
    body: { content: { "application/json": { schema: z.object({ looksLikeMe: z.boolean(), helpful: z.boolean() }) } } },
  },
  responses: {
    204: { description: "Feedback recorded" },
    404: { content: { "application/json": { schema: errorSchema } }, description: "Not found" },
    ...standardErrors,
  },
});

export const deleteAccountRoute = createRoute({
  operationId: "deleteAccount",
  method: "delete",
  path: "/account",
  tags: ["Account"],
  responses: {
    202: {
      content: { "application/json": { schema: z.object({ cleanupQueued: z.number().int() }) } },
      description: "Business data deleted and file cleanup queued",
    },
    409: {
      content: { "application/json": { schema: errorSchema } },
      description: "Sign in with Apple reauthentication required",
    },
    ...standardErrors,
  },
});

export const accountStatusRoute = createRoute({
  operationId: "getAccountStatus",
  method: "get",
  path: "/account/status",
  tags: ["Account"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            userId: z.string(),
            isPro: z.boolean(),
            allowance: z.number().int(),
            paidAllowance: z.number().int(),
            used: z.number().int(),
            remaining: z.number().int(),
            periodKey: z.string(),
          }),
        },
      },
      description: "Server-authoritative identity, entitlement, and generation allowance",
    },
    ...standardErrors,
  },
});

export const registerPushDeviceRoute = createRoute({
  operationId: "registerPushDevice",
  method: "put",
  path: "/push/device",
  tags: ["Account"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            token: z.string().regex(/^[a-f0-9]{64,200}$/),
            environment: z.enum(["sandbox", "production"]),
          }),
        },
      },
    },
  },
  responses: { 204: { description: "Push device registered for render completion notifications" }, ...standardErrors },
});
