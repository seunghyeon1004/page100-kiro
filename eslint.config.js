import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(globalIgnores(["dist/", "coverage/"]), {
  files: ["**/*.ts"],
  extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
  languageOptions: {
    parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
  },
  rules: {
    "@typescript-eslint/ban-ts-comment": [
      "error",
      {
        "ts-expect-error": "allow-with-description",
        "ts-ignore": true,
        "ts-nocheck": true,
        minimumDescriptionLength: 10,
      },
    ],
  },
});
