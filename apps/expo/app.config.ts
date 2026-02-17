import { withInfoPlist } from "@expo/config-plugins";
import type { ConfigContext, ExpoConfig } from "expo/config";

const APP_NAME = "Wearbloom";
const APP_SLUG = "wearbloom";
const APP_SCHEME = "wearbloom";
const APP_BUNDLE_ID = "com.axel.wearbloom";
const API_URL = "https://api.wearbloom.app";

export default ({ config, mode }: ConfigContext): ExpoConfig => {
  const buildMode = process.env.NODE_ENV ?? mode;
  const isProduction = buildMode === "production";
  const atsConfig = isProduction
    ? {
        NSAllowsArbitraryLoads: false,
      }
    : {
        NSAllowsArbitraryLoads: false,
        NSExceptionDomains: {
          localhost: {
            NSExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      };

  return {
    ...config,
    name: APP_NAME,
    slug: APP_SLUG,
    scheme: APP_SCHEME,
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon-light.png",
    userInterfaceStyle: "automatic",
    updates: {
      fallbackToCacheTimeout: 0,
    },
    newArchEnabled: true,
    assetBundlePatterns: ["**/*"],
    extra: {
      ...config.extra,
      apiUrl: API_URL,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: APP_BUNDLE_ID,
      supportsTablet: true,
      icon: {
        light: "./assets/icon-light.png",
        dark: "./assets/icon-dark.png",
      },
      infoPlist: {
        ...config.ios?.infoPlist,
        NSAppTransportSecurity: atsConfig,
      },
    },
    android: {
      package: APP_BUNDLE_ID,
      adaptiveIcon: {
        foregroundImage: "./assets/icon-light.png",
        backgroundColor: "#1F104A",
      },
      edgeToEdgeEnabled: true,
    },
    // extra: {
    //   eas: {
    //     projectId: "your-eas-project-id",
    //   },
    // },
    experiments: {
      tsconfigPaths: true,
      typedRoutes: true,
      reactCanary: true,
      reactCompiler: true,
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-web-browser",
      "expo-apple-authentication",
      "expo-iap",
      [
        "expo-image-picker",
        {
          photosPermission:
            "Allow Wearbloom to access your photos to set your body avatar.",
          cameraPermission:
            "Allow Wearbloom to use your camera to take a body photo.",
        },
      ],
      [
        "expo-splash-screen",
        {
          backgroundColor: "#E4E4E7",
          image: "./assets/icon-light.png",
          dark: {
            backgroundColor: "#18181B",
            image: "./assets/icon-dark.png",
          },
        },
      ],
      (expoConfig) =>
        withInfoPlist(expoConfig, (modConfig) => {
          modConfig.modResults.NSAppTransportSecurity = atsConfig;
          return modConfig;
        }),
    ],
  };
};
