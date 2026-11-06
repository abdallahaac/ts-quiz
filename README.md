# Brightspace multiple-choice quiz

A strict TypeScript/Vite refactor of the supplied quiz. Authors still edit the
four-column HTML table in Brightspace Design View. The parser reads that table
on every page load; there is no compiled question bank or author-facing JSON.
The existing quiz styling, text, answer behavior and carousel are preserved.

## Import questions from Word (editor mode)

A DOCX importer is available **inside the existing quiz authoring view** when
JavaScript is executing. For a local test, change `config.json` to
`{"editorMode":true}`, run `npm run dev`, and visit
`http://127.0.0.1:5173/brightspace-quiz.html`.

1. Create a .docx Word table with **Question | Instructions | Answers | Feedback**
   as its header row. Each subsequent row is one question. In the Answers
   column, place **each answer in its own paragraph**, prefixing exactly one
   answer with `[CORRECT]`.
2. Select that file in **Import questions from Word**. The same quiz parser
   validates the converted HTML before enabling **Replace question rows**.
3. Apply the import to replace the existing question rows (the original table
   headings and widths are retained). The resulting table can still be edited.
4. **Copy table HTML** to carry the changes into the source HTML. Browser edits
   do not automatically save back to your local `brightspace-quiz.html`
   or to Brightspace Manage Files.

The importer runs locally in the browser without uploading DOCX contents to a
server, and does not add a runtime npm dependency. It accepts standard OOXML
DOCX tables; it imports **plain text**, including answer markers, not embedded
images or complex formatting. Merged cells, nested tables, missing/invalid
columns, incomplete questions, and duplicate/missing correct markers are rejected.

**Brightspace limitation:** The native Brightspace Edit HTML / Design View may
disable or strip author JavaScript and file-input controls. Therefore this
progressively enhanced panel is confirmed as an intended **local editor
simulation**, not a guaranteed working button inside the authenticated
Brightspace HTML editor. A separate authorized integration would be required if
the editor suppresses script execution. The deployed quiz still works normally
without the importer; authored HTML remains the source of truth.

## Develop and verify

Use Node 24 LTS (minimum 22.12) and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite followed by `/brightspace-quiz.html`. This page uses
ES modules from `src/`, direct npm imports from `@brightspace-ui/core`, and local Lato assets.

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:dev
npm run preview
```

`npm run check` runs type checking, Vitest, and the production build. Browser tests
use an installed Google Chrome; to use Playwright Chromium instead, remove
`channel: 'chrome'` in `playwright.config.ts` and run `npx playwright install chromium`.
They start a local server automatically and exercise a nested course-folder URL.
`npm run test:dev` verifies the Vite page, npm imports, dictionaries and local fonts.
No Brightspace account is needed for local checks. The visual comparison serves
the original quiz application against the same npm components as the refactor,
isolating application changes from component-library version changes.

## Deploy to Brightspace

1. Run `npm run build`.
2. Upload **the contents of `dist/` together** into one folder in Manage Files.
   Retain the `assets/`, `fonts/`, and `licenses/` subfolders.
3. Create a content topic linking to `brightspace-quiz.html` in that folder.
4. Open Edit HTML / Design View, change a question in the table, then Save and
   Close. Reopen the learner topic to use the saved content.

```text
dist/
  brightspace-quiz.html        editable authoring table + inlined CSS
  assets/
    native-quiz.js             classic IIFE; no application runtime dependencies
    brightspace-components.js compiled from @brightspace-ui/core npm imports
  fonts/                      Lato regular/bold, normal/italic
  licenses/                   Apache 2.0 and Lato OFL notices
  NOTICE.md
```

Asset URLs are relative to the topic folder. Both production scripts are classic
IIFEs with no runtime module imports. The npm component build includes its language
dictionaries and icon data, so there are no separate language files to upload.
A separate component script lets the application use native controls if that
asset is unavailable. The supplied `brightspace-core-bundle.js` is unused and is
not copied into the package. No npm installation is needed inside Brightspace.

The two original Brightspace theme stylesheet links are retained. The
`/d2l/le/contentstyler/6606/files/View` override belongs to the original tenant;
when deploying elsewhere, use that course's appropriate override or remove that
link if no override is needed. Local quiz styling and controls work without it.
Production quiz CSS is inline so Design View and loading states work before
JavaScript, including when the editor does not execute scripts.

## Author questions

Keep the headings **Question, Instructions, Answers, Feedback**, in that order.
Each row is one question. Use one Heading 2 in Question, optional instructions,
at least two answer paragraphs (or one flat list), and meaningful feedback. Put
`[CORRECT]` before exactly one answer. Rich formatting may split the marker;
the parser recognizes it across text nodes. Entirely blank rows are ignored.
Partly completed rows produce specific diagnostics rather than a partial quiz.

Insert or delete rows through Brightspace's table controls. Do not merge cells,
add columns, nest tables, or mix answer paragraphs with a list. Learners can
navigate freely; their answers and feedback persist between slides. Check locks
the current answer; Try Again resets that question. Nothing is sent to a gradebook.

Course authors need no Node, TypeScript, or rebuild to edit questions in the
**deployed HTML**. Developers should edit the root `brightspace-quiz.html` when
changing the local question bank. Before redeploying code to a course with edited
questions, download its current HTML and carry its authored table into the local
HTML: a build regenerates `dist/` from local source, not from the live course.

## Project structure

```text
brightspace-quiz.html          authorable source page / Vite development entry
brightspace-core-bundle.js    original supplied artifact, unused by the project
src/
  main.ts                     browser bootstrap, HMR and back/forward restoration
  domain/models.ts            question, answer, attempt, state and strategy types
  application/
    initialize.ts             mounting, diagnostics, editor/asset detection, disposal
    QuizSession.ts            state transitions and typed subscriptions
    QuizController.ts         learner commands and focus/announcement coordination
  parsers/
    QuizParser.ts             table and legacy block extraction
    QuizValidator.ts          semantic question validation
    richContent.ts            safe rich HTML, text normalization, marker extraction
  strategies/MultipleChoiceStrategy.ts
  adapters/                   npm component registration and custom/native adapter
  events/QuizEventEmitter.ts
  views/                      quiz, question, feedback, navigation markup
  styles/quiz.css              preserved original styling
  utils/markup.ts             escaping and answer letters
scripts/                      asset preparation and build/test tooling
tests/                        Vitest cases and original comparison fixture
  browser/                    Chrome visual, keyboard and accessibility checks
docs/architecture.md          original analysis, patterns and function mapping
```

## Architecture and validation

[Architecture and original-function mapping](docs/architecture.md) explains the
selected Strategy, Observer and Adapter patterns, component factories and typed
state transitions. A controller receives its session and view; a session receives
its grading strategy. No application framework is required.

Tests compare the recovered parser against the original for valid, invalid,
empty, incomplete and legacy content. DOM tests cover grading, feedback, native
and custom controls, initialization, editor transitions and disposal. Browser
tests cover nested paths, table edits, keyboard radios, missing assets, editor
visibility, axe accessibility scans, and pixel-identical comparisons against the
original at desktop and mobile widths.

These are local Chrome checks with a neutral course theme; authenticated
Brightspace editor sanitization and tenant-specific theme overrides need a final
smoke check in the target course. Npm component versions are pinned by `package-lock.json`; upgrade them deliberately
and rerun the browser checks. Third-party attribution is in [NOTICE.md](NOTICE.md).
