// Learn more: https://docs.expo.dev/guides/monorepos/
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { FileStore } = require("metro-cache");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the entire monorepo so Metro sees workspace packages
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from both the app and the monorepo root
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  blockList: [/\.test\.[jt]sx?$/],
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
  ],
};

config.cacheStores = [
  new FileStore({
    root: path.join(projectRoot, "node_modules", ".cache", "metro"),
  }),
];

/** @type {import('expo/metro-config').MetroConfig} */
module.exports = withNativeWind(config, { input: "./src/styles.css" });
