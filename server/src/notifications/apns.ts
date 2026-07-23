import { connect } from "node:http2";
import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";
import type { AppConfig } from "../config";

const errorResponseSchema = z.object({ reason: z.string().optional() });

type PushInput = {
  token: string;
  environment: "sandbox" | "production";
  renderId: string;
  status: "succeeded" | "failed";
};

export class APNSClient {
  private key?: ReturnType<typeof importPKCS8>;
  private token?: { value: string; createdAt: number };

  constructor(private readonly config: AppConfig) {}

  async send(input: PushInput): Promise<"sent" | "unregistered" | "skipped"> {
    if (!this.config.APPLE_TEAM_ID || !this.config.APNS_KEY_ID || !this.config.APNS_PRIVATE_KEY) return "skipped";
    if (input.environment !== this.config.APNS_ENVIRONMENT) return "skipped";
    const authorization = await this.authorization();
    const origin =
      input.environment === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
    const payload =
      input.status === "succeeded"
        ? {
            aps: {
              alert: { title: "Your look is ready", body: "Open WearBloom to see your new preview." },
              sound: "default",
            },
            destination: "looks",
            renderId: input.renderId,
          }
        : {
            aps: {
              alert: {
                title: "That preview needs another try",
                body: "No generation was used. Open WearBloom to try again.",
              },
              sound: "default",
            },
            destination: "looks",
            renderId: input.renderId,
          };
    const response = await request(
      origin,
      `/3/device/${input.token}`,
      {
        authorization: `bearer ${authorization}`,
        "apns-topic": this.config.APNS_TOPIC,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      JSON.stringify(payload),
    );
    if (response.status === 200) return "sent";
    if (response.status === 410 || response.reason === "Unregistered" || response.reason === "BadDeviceToken")
      return "unregistered";
    console.error(
      JSON.stringify({
        level: "error",
        message: "APNs delivery failed",
        status: response.status,
        reason: response.reason,
      }),
    );
    return "skipped";
  }

  private async authorization(): Promise<string> {
    if (this.token && Date.now() - this.token.createdAt < 50 * 60_000) return this.token.value;
    const keyId = this.config.APNS_KEY_ID;
    const teamId = this.config.APPLE_TEAM_ID;
    const privateKey = this.config.APNS_PRIVATE_KEY;
    if (!keyId || !teamId || !privateKey) throw new Error("APNS_NOT_CONFIGURED");
    this.key ??= importPKCS8(privateKey.replace(/\\n/g, "\n"), "ES256");
    const value = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt()
      .sign(await this.key);
    this.token = { value, createdAt: Date.now() };
    return value;
  }
}

function request(
  origin: string,
  path: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; reason?: string }> {
  return new Promise((resolve, reject) => {
    const client = connect(origin);
    client.once("error", reject);
    const stream = client.request({ ":method": "POST", ":path": path, ...headers });
    let status = 0;
    let response = "";
    stream.setEncoding("utf8");
    stream.on("response", (received) => {
      status = Number(received[":status"] ?? 0);
    });
    stream.on("data", (chunk: string) => {
      response += chunk;
    });
    stream.on("error", (error) => {
      client.close();
      reject(error);
    });
    stream.on("end", () => {
      client.close();
      const reason = parseReason(response);
      resolve(reason ? { status, reason } : { status });
    });
    stream.end(body);
  });
}

function parseReason(response: string): string | undefined {
  if (!response) return undefined;
  try {
    const parsed = errorResponseSchema.safeParse(JSON.parse(response));
    return parsed.success ? parsed.data.reason : undefined;
  } catch {
    return undefined;
  }
}
