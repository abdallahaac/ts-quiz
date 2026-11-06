import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { Script } from "node:vm";
const read = (path) => readFile(path, "utf8");
const [html, app, components, source] = await Promise.all([
  read("dist/brightspace-quiz.html"),
  read("dist/assets/native-quiz.js"),
  read("dist/assets/brightspace-components.js"),
  read("brightspace-quiz.html"),
]);
// Both outputs must parse as classic scripts with no runtime module imports.
new Script(app);
new Script(components);
assert(
  !/\bimport\s*\(/.test(app + components),
  "All dynamic language and icon imports must be bundled",
);
assert(
  html.includes(
    '<script defer data-quiz-runtime src="./assets/native-quiz.js"></script>',
  ),
);
assert(
  html.includes(
    '<script defer src="./assets/brightspace-components.js"></script>',
  ),
);
assert(!html.includes("/src/") && !html.includes("/@vite/"));
assert(!html.includes("brightspace-core-bundle.js"));
assert(!(await readdir("dist/assets")).includes("brightspace-core-bundle.js"));
assert(html.includes('url("./fonts/Lato-400.woff2")'));
const authoring = (page) =>
  page.slice(
    page.indexOf('<div id="quiz-authoring-source"'),
    page.indexOf("\n\t\t\t<section"),
  );
assert.equal(
  authoring(html),
  authoring(source),
  "Build must preserve editable HTML content",
);
assert(components.includes("components.alert.close"));
assert(components.includes("intl-common:actions:close"));
await Promise.all(
  [
    "fonts/Lato-400.woff2",
    "fonts/Lato-700-italic.woff2",
    "licenses/Lato-OFL.txt",
    "licenses/Brightspace-APACHE-2.0.txt",
    "licenses/components.md",
    "NOTICE.md",
  ].map((name) => access(`dist/${name}`)),
);
console.log(
  "Verified classic scripts, authoring HTML, bundled npm components/languages/icons, fonts and notices.",
);
