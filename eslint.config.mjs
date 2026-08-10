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
    // Not part of the Next.js app: `front-end-ref` is the gitignored Figma/Vite reference
    // scaffold and `supabase/.temp` is CLI scratch output. Linting them buried real findings
    // under ~190 pre-existing problems.
    "front-end-ref/**",
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
