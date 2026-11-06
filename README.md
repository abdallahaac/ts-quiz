# Brightspace multiple-choice quiz

A strict TypeScript/Vite refactor of the supplied quiz. Authors still edit the
four-column HTML table in Brightspace Design View. The parser reads that table
on every page load; there is no compiled question bank or author-facing JSON.
The existing quiz styling, text, answer behavior and carousel are preserved.

## Import questions from Word in Brightspace

The Brightspace Design View cannot be relied upon to run custom JavaScript.
Consequently the authoring interface includes a **static "Import questions from
Word" link**, visible in Design View even when scripts are disabled. The link
opens `import-questions.html`, a separate HTML page served from the **same
Manage Files folder**. This page runs the DOCX parser and can export question
table HTML or a complete updated quiz file. No Brightspace API credentials are
needed.

1. Run `npm run build` and upload the **entire `dist/` contents** to one
   Manage Files directory: `index.html`, `import-questions.html`,
   `assets/docx-importer.js`, `assets/native-quiz.js`,
   `assets/brightspace-components.js`, CSS, fonts, and licenses.
2. Open the quiz's **Edit HTML / Design View**. Select **Import questions from
   Word**. If Brightspace rewrites the relative link, use the editor's link
   picker or Code View to point it to the actual `import-questions.html` URL
   in that course's Manage Files directory. Use a course-specific link; do not
   hard-code a sandbox course's address into the reusable source.
3. In the importer page, choose a `.docx` whose table has these exact headers:
   **Question | Instructions | Answers | Feedback**. Each row is one question.
   Put each answer in a separate paragraph; prefix exactly one answer with
   `[CORRECT]`. Invalid questions are rejected before export.
4. Choose **Copy question table HTML** to replace the table through Brightspace
   Code View, **or** choose **Download updated quiz HTML** to create a new
   `index.html` containing the new questions. By default this downloads the
   current `./index.html` from the same folder; if blocked, supply a downloaded
   current copy under **Existing quiz HTML**.
5. Back up the existing quiz HTML before replacing it in Manage Files and verify
   the learner view. The importer **does not automatically save** to Brightspace,
   nor does it upload the DOCX to a server. Brightspace authors must save/publish
   the updated HTML themselves.

### Testing locally

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/import-questions.html` directly, or set
`config.json` to `{"editorMode":true}` and follow the static link from the
quiz's editor simulation. The production scripts are classic IIFEs; neither
Brightspace nor the importer needs a Node or Vite runtime after deployment.

The Word parser supports simple OOXML tables and plain-text question paragraphs.
It intentionally rejects embedded images, merged cells and nested tables. It
does not preserve Word formatting. The export keeps the existing quiz's
original scripts, styles, font references and question-table structure.

## Develop and verify

Use Node 24 LTS (minimum 22.12) and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite followed by `/index.html`. This page uses
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
3. Create a content topic linking to `index.html` in that folder.
4. Open Edit HTML / Design View, change a question in the table, then Save and
   Close. Reopen the learner topic to use the saved content.

```text
dist/
  index.html        editable authoring table + static Word import link
  import-questions.html       standalone browser DOCX importer
  assets/
    docx-importer.js          self-contained classic importer script
    quiz.css                 standalone CSS copy for reuse
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
JavaScript, including when the editor does not execute scripts. The build also
emits `dist/assets/quiz.css` for standalone reuse; this CSS is intentionally
not loaded a second time by the HTML. Both copies include the DOCX importer
styles, with font URLs adjusted for their respective locations. Build verification
fails if either copy or the expected font references are missing.

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
**deployed HTML**. Developers should edit the root `index.html` when
changing the local question bank. Before redeploying code to a course with edited
questions, download its current HTML and carry its authored table into the local
HTML: a build regenerates `dist/` from local source, not from the live course.

## Project structure

```text
index.html          authorable source page / Vite development entry
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
