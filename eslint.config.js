import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const physicalDirectionClasses =
  "(^|\s|:)-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|float-left|float-right|text-left|text-right)(-|\s|$)";

const arbitraryColorValue = "#[0-9a-fA-F]{3,8}";

const directionRuleMessage =
  "Use Tailwind logical properties (ms-/me-/ps-/pe-/start-/end-/text-start/text-end) so the UI mirrors correctly in Arabic RTL.";

const colorRuleMessage = "Use a design token from app.css instead of an arbitrary color value.";

const navigationImportPaths = [
  {
    name: "react-router",
    importNames: ["Link", "NavLink", "useNavigate", "Navigate"],
    message: "Import navigation from @/i18n/navigation so links stay locale-aware.",
  },
];

const restrictedSyntax = [
  "error",
  {
    selector: `JSXAttribute[name.name="className"] Literal[value=/${physicalDirectionClasses}/]`,
    message: directionRuleMessage,
  },
  {
    selector: `JSXAttribute[name.name="className"] TemplateElement[value.raw=/${physicalDirectionClasses}/]`,
    message: directionRuleMessage,
  },
  {
    selector: `CallExpression[callee.name="cn"] Literal[value=/${physicalDirectionClasses}/]`,
    message: directionRuleMessage,
  },
  {
    selector: `JSXAttribute[name.name="className"] Literal[value=/${arbitraryColorValue}/]`,
    message: colorRuleMessage,
  },
  {
    selector: 'JSXOpeningElement[name.name="svg"]',
    message:
      "Keep SVG files in src/icons and render them through the Icon component instead of inlining markup.",
  },
  {
    selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
    message: "Never render user content as HTML.",
  },
];

export default defineConfig([
  globalIgnores(["dist", "coverage", "src/lib/api/schema.d.ts", "tayea_mills"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: navigationImportPaths,
          patterns: [
            {
              group: ["@/features/*/*"],
              message: "Import a feature only through its public index (@/features/<name>).",
            },
          ],
        },
      ],
      "no-restricted-syntax": restrictedSyntax,
    },
  },
  {
    files: ["src/features/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: navigationImportPaths,
          patterns: [
            {
              group: ["@/features/*", "@/features/*/*"],
              message:
                "Features must not import each other. Move the shared need into components/ui or lib.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/i18n/navigation.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["vite.config.ts", "scripts/**"],
    languageOptions: { globals: globals.node },
  },
]);
