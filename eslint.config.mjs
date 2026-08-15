import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: [
      "src/components/canvas/PipelineView.tsx",
      "src/components/documents/DocumentsView.tsx",
      "src/components/panel/SidePanel.tsx",
      "src/hooks/usePanelWidth.ts",
      "src/components/shell/FileExplorer.tsx",
      "src/components/shell/TabEditor.tsx",
    ],
    // Next 16 exposes newer React compiler-oriented hook rules. The current
    // components deliberately hydrate local UI state in effects. Retain the
    // established behavior until those flows are migrated independently.
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    files: ["src/hooks/usePipelineStream.ts"],
    // This stream hook keeps the latest callbacks in a ref so reconnecting
    // EventSources do not capture stale closures.
    rules: { "react-hooks/refs": "off" },
  },
  {
    files: ["e2e/**/*.{ts,tsx}"],
    // Playwright fixtures name their continuation callback `use`; it is not a
    // React hook and otherwise triggers a false positive.
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    files: ["scripts/e2e-heal.mts"],
    // This CLI decodes Claude's external JSON event stream incrementally.
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
