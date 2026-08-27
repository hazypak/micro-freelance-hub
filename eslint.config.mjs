import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // These two rules fire on intentionally non-idiomatic React patterns that
  // the codebase uses deliberately (client-only hydration seeding and a
  // real-time ref mirror). We keep the rules off project-wide rather than
  // sprinkling eslint-disable comments into each consumer file.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "off",
    },
  },
]);

export default eslintConfig;
