import * as path from "node:path";
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import jestPlugin from "eslint-plugin-jest";
import turboPlugin from "eslint-plugin-turbo";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * All packages that leverage t3-env should use this rule
 */
export const restrictEnvAccess = defineConfig(
  { ignores: ["**/env.ts"] },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Use `import { env } from '~/env'` instead to ensure validated types.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          name: "process",
          importNames: ["env"],
          message:
            "Use `import { env } from '~/env'` instead to ensure validated types.",
        },
      ],
    },
  },
);

export const baseConfig = defineConfig(
  // Ignore files not tracked by VCS and any config files
  includeIgnoreFile(path.join(import.meta.dirname, "../../.gitignore")),
  { ignores: ["**/*.config.*"] },
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    plugins: {
      import: importPlugin,
      turbo: turboPlugin,
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      ...turboPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-misused-promises": [
        2,
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        {
          allowConstantLoopConditions: true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
    },
  },
  {
    linterOptions: { reportUnusedDisableDirectives: true },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Test file overrides — Bun's spyOn/mock return `any`, causing false positives
  // on type-aware rules. Only these specific rules are relaxed; all other
  // type-checking remains active in test files.
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/test/**/*.ts"],
    plugins: {
      jest: jestPlugin,
    },
    settings: {
      jest: { globalPackage: "bun:test" },
    },
    rules: {
      // jest-aware version understands expect(obj.method) patterns
      "@typescript-eslint/unbound-method": "off",
      "jest/unbound-method": "error",

      // Bun spyOn/mock returns `any` — fires on .mockRestore(), assignments, etc.
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",

      // Mocked functions may return sync values where originals were async
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/require-await": "off",

      // Common test patterns: noop stubs and test assertions
      "@typescript-eslint/no-empty-function": [
        "error",
        { allow: ["arrowFunctions", "methods", "constructors"] },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
