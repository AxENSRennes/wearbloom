const nativewind = require("nativewind/preset");
const baseConfig = require("@acme/tailwind-config");

// Resolve the default export (ESM interop)
const base = baseConfig.default || baseConfig;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  presets: [nativewind, base],
};
