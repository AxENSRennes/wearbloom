import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";

export interface AppleIapConfig {
  appleIapKeyId: string;
  appleIapIssuerId: string;
  appleIapKeyPath: string;
  appleBundleId: string;
  appleAppId?: number;
  nodeEnv: "development" | "production";
  certsDir: string;
}

function getEnvironment(nodeEnv: string): Environment {
  return nodeEnv === "production"
    ? Environment.PRODUCTION
    : Environment.SANDBOX;
}

function loadRootCAs(certsDir: string): Buffer[] {
  const certFiles = [
    "AppleRootCA-G3.cer",
    "AppleComputerRootCertificate.cer",
    "AppleIncRootCertificate.cer",
  ];
  return certFiles.map((file) => readFileSync(resolve(certsDir, file)));
}

export function createAppleClient(
  config: AppleIapConfig,
): AppStoreServerAPIClient {
  if (
    !config.appleIapKeyId ||
    !config.appleIapIssuerId ||
    !config.appleIapKeyPath
  ) {
    throw new Error(
      "Missing Apple IAP configuration: APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, and APPLE_IAP_KEY_PATH are required",
    );
  }

  const encodedKey = readFileSync(config.appleIapKeyPath, "utf-8");
  const environment = getEnvironment(config.nodeEnv);

  return new AppStoreServerAPIClient(
    encodedKey,
    config.appleIapKeyId,
    config.appleIapIssuerId,
    config.appleBundleId,
    environment,
  );
}

export function createVerifier(config: AppleIapConfig): SignedDataVerifier {
  const appleRootCAs = loadRootCAs(config.certsDir);
  const environment = getEnvironment(config.nodeEnv);

  return new SignedDataVerifier(
    appleRootCAs,
    true, // enableOnlineChecks (OCSP)
    environment,
    config.appleBundleId,
    config.nodeEnv === "production" ? config.appleAppId : undefined,
  );
}
