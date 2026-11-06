import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const components = mode === "components";
  const importer = mode === "importer";
  return {
    base: "./",
    optimizeDeps: { exclude: ["@brightspace-ui/core", "@brightspace-ui/intl"] },
    build: {
      target: "es2022",
      // The components build starts a clean package; the application build adds to it.
      emptyOutDir: components,
      copyPublicDir: components,
      lib: {
        entry: resolve(
          components
            ? "src/adapters/registerBrightspace.ts"
            : importer
              ? "src/importer-main.ts"
              : "src/main.ts",
        ),
        name: components
          ? "BrightspaceComponents"
          : importer
            ? "BrightspaceWordImporter"
            : "BrightspaceQuiz",
        formats: ["iife"],
        fileName: () =>
          components
            ? "assets/brightspace-components.js"
            : importer
              ? "assets/docx-importer.js"
              : "assets/native-quiz.js",
      },
      dynamicImportVarsOptions: { exclude: [] },
      rolldownOptions: { output: { codeSplitting: false } },
      license: {
        fileName: components
          ? "licenses/components.md"
          : importer
            ? "licenses/importer.md"
            : "licenses/application.md",
      },
      minify: true,
    },
    plugins: components || importer
      ? []
      : [
          {
            name: "brightspace-authoring-page",
            async closeBundle() {
              const [html, css, importerHTML] = await Promise.all([
                readFile("index.html", "utf8"),
                readFile("src/styles/quiz.css", "utf8"),
                readFile("import-questions.html", "utf8"),
              ]);
              const stylesheetLink =
                '<link rel="stylesheet" href="./src/styles/quiz.css" />';
              if (!html.includes(stylesheetLink)) {
                throw new Error(
                  "The source HTML must reference ./src/styles/quiz.css so the production stylesheet can be embedded.",
                );
              }

              // The HTML lives at the package root, while the standalone CSS
              // lives in assets/. Both must resolve the same fonts/ directory.
              const inlineCSS = css.replaceAll("../../fonts/", "./fonts/");
              const assetCSS = css.replaceAll("../../fonts/", "../fonts/");
              const production = html
                .replace(
                  stylesheetLink,
                  `<style data-quiz-bundled-css>\n${inlineCSS}\n</style>`,
                )
                .replace(
                  /<script\s+type="module"\s+src="\.\/src\/adapters\/registerBrightspace\.ts"\s*><\/script>/,
                  '<script defer src="./assets/brightspace-components.js"></script>',
                )
                .replace(
                  '<script type="module" src="./src/main.ts"></script>',
                  '<script defer data-quiz-runtime src="./assets/native-quiz.js"></script>',
                );
              if (production.includes("./src/")) {
                throw new Error(
                  "The production HTML still references development source files.",
                );
              }
              const importerEntrypoint =
                '<script type="module" src="./src/importer-main.ts"></script>';
              if (!importerHTML.includes(importerEntrypoint)) {
                throw new Error("The DOCX importer page is missing its development entry point.");
              }
              const productionImporter = importerHTML.replace(
                importerEntrypoint,
                '<script defer src="./assets/docx-importer.js"></script>',
              );
              await mkdir("dist/assets", { recursive: true });
              await Promise.all([
                writeFile("dist/index.html", production),
                writeFile("dist/import-questions.html", productionImporter),
                writeFile("dist/assets/quiz.css", assetCSS),
                copyFile("NOTICE.md", "dist/NOTICE.md"),
              ]);
            },
          },
        ],
  };
});
