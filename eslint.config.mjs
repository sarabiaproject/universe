import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Web storage can throw (blocked: SecurityError, full: QuotaExceededError). Only
  // src/lib/storage.ts touches it, with try/catch (review slice 1, B1/D1).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/storage.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Usa src/lib/storage.ts: localStorage puede lanzar." },
        { name: "sessionStorage", message: "Usa src/lib/storage.ts: sessionStorage puede lanzar." },
      ],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].flatMap((object) =>
          ["localStorage", "sessionStorage"].map((property) => ({
            object,
            property,
            message: "Usa src/lib/storage.ts: el almacenamiento puede lanzar.",
          })),
        ),
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
