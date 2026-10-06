import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist",
    "coverage/**",
    "node_modules/**",
    "*.yml",
    "*.lock",
    "build/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      {
        files: ["src/App.tsx"],
        rules: {
          "react-refresh/only-export-components": [
            "error",
            { extraHOCs: ["withAuthenticationRequired"] },
          ],
        },
      },
      prettierConfig,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
]);
