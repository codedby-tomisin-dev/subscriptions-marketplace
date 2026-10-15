import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Route handlers and generated images must not import a feature's index: it also exports
    // styled components, and their CSS then ships as a <script> on every page (unstyled dialogs).
    files: ["app/**/route.ts", "app/**/opengraph-image.tsx", "app/**/twitter-image.tsx", "app/**/sitemap.ts", "app/**/robots.ts", "src/features/share/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: "^@/features/[^/]+$", message: "Import the module itself (e.g. @/features/catalog/api), not the feature index." }] },
      ],
    },
  },
];

export default eslintConfig;
