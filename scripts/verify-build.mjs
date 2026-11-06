import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { Script } from "node:vm";
const read = (path) => readFile(path, "utf8");
const [html, app, components, source, stylesheet, importerHTML, importerJS] = await Promise.all([
	read("dist/index.html"),
	read("dist/assets/native-quiz.js"),
	read("dist/assets/brightspace-components.js"),
	read("index.html"),
	read("dist/assets/quiz.css"),
	read("dist/import-questions.html"),
	read("dist/assets/docx-importer.js"),
]);
// Both outputs must parse as classic scripts with no runtime module imports.
new Script(app);
new Script(components);
new Script(importerJS);
assert(
	!/\bimport\s*\(/.test(app + components + importerJS),
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
assert(
  html.includes('href="./import-questions.html"'),
  "Brightspace Design View must include the static Word importer link",
);
assert(
  html.includes(".quiz-docx-import-link"),
  "The inline stylesheet must include authoring link styles",
);
assert(
  importerHTML.includes('<script defer src="./assets/docx-importer.js"></script>'),
  "The standalone Word importer must load its compiled classic script",
);
assert(
  !importerHTML.includes("./src/") && !importerHTML.includes("/@vite/"),
  "The Word importer must not depend on Vite source modules",
);
assert(
  importerHTML.includes('id="word-file"') &&
    importerHTML.includes('id="download-quiz"'),
  "The standalone importer must include DOCX upload and HTML export controls",
);

assert(
  html.includes('<style data-quiz-bundled-css>'),
  "Production HTML must embed the quiz CSS for Brightspace editor compatibility",
);
assert(
  html.includes(".quiz-docx-import-link"),
  "Production HTML is missing DOCX importer styling",
);
assert(
  stylesheet.includes(".quiz-docx-import-link"),
  "Standalone CSS is missing DOCX importer styling",
);
assert(
  stylesheet.includes('url("../fonts/Lato-400.woff2")'),
  "Standalone CSS must resolve fonts from the assets/ folder",
);
assert(
  !stylesheet.includes("../../fonts/"),
  "Standalone CSS contains development-only font paths",
);
assert(
  !html.includes("./src/styles/quiz.css"),
  "Production HTML must not reference the source stylesheet",
);

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
	"Verified classic quiz and importer scripts, static Brightspace import link, importer page, CSS, fonts and bundled components.",
);
