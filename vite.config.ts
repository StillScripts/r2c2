import { defineConfig } from "vite-plus"

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    endOfLine: "lf",
    semi: false,
    singleQuote: false,
    tabWidth: 2,
    trailingComma: "es5",
    printWidth: 80,
    sortPackageJson: false,
    sortTailwindcss: {
      stylesheet: "packages/ui/src/styles/globals.css",
      functions: ["cn", "cva"],
    },
    ignorePatterns: [
      "pnpm-lock.yaml",
      "**/*.gen.ts",
      "**/convex/_generated/**",
      "packages/backend/{.agents,.claude/skills}/**",
      "packages/backend/{AGENTS.md,CLAUDE.md,skills-lock.json}",
    ],
  },
  test: {
    projects: ["apps/*", "packages/*"],
  },
})
