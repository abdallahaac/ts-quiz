# Architecture and migration

## Original implementation, inspected before modification

The supplied HTML is already a generated artifact: its script labels identify
`src/native-quiz/parser.js`, `carousel.js`, and `main.js`, but those source files
were not supplied. Its inline stylesheet also says it was generated. We recovered
application behavior from that readable generated code. The original page is
preserved at `tests/fixtures/original.html` for parser and visual comparisons.

| Responsibility                      | Original behavior and coupling                                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authoring and parsing               | `parseQuestions` chooses the four-column table or legacy Heading 2/Heading 3/data-attribute blocks. `tableAnswerList` adapts paragraphs, wrappers and lists; `answerFromListItem` finds `[CORRECT]` even across formatted text.                  |
| Validation and diagnostics          | Parsing also validates table structure, headings, answer counts, placeholders, nested choices, feedback and marker count. It accumulates author-readable strings and blocks initialization on any diagnostic.                                    |
| Initialization and editor detection | `initialize` finds fixed source/root selectors, checks `designMode`, editable body and TinyMCE class, then directly creates diagnostics or the carousel. A module-level WeakMap avoids duplicate mounts.                                         |
| State and evaluation                | `createCarousel` closes over mutable `index`, `answers`, `checked`, and `direction`. Event handlers mutate these maps and derive correctness directly from answer flags.                                                                         |
| Carousel and progress               | The same closure renders slides, Previous/Next boundaries, question counters, dot navigation and direction classes. Navigation preserves answers. There is no separate completion screen.                                                        |
| Feedback                            | The carousel finds the correct answer and renders its letter plus the authored explanation. It announces correct/incorrect and moves focus into feedback after Lit rendering. Try Again resets only the current question.                        |
| DOM and events                      | Full HTML rendering and event binding happen inside the carousel. Every render creates handlers again. Broad answer-row clicks select radios while links, labels and inputs keep native behavior.                                                |
| Brightspace integration             | Boolean `components` branches across button, instruction and feedback rendering. The initializer probes the custom-element registry and optionally checks a language file; failure rebuilds the carousel with native controls, losing its state. |
| Accessibility                       | Native radios and fieldset/legend, named radiogroups, focusable slides and feedback, live announcements, disabled/hidden controls, native radio keyboard interaction, icon text alternatives and reduced-motion CSS.                             |
| Styling and assets                  | Inline generated CSS, Lato font URLs, loading/editor rules, externally hosted theme styles, and a tenant-specific bundle path. The supplied font/language resources are absent.                                                                  |

The main Single Responsibility violation is the carousel closure: it grades,
changes state, generates multiple component types, renders every region, binds
input, manages focus and announces results. Parser DOM structure rules and
semantic validation are interleaved. Component/fallback decisions are repeated. Startup styling is duplicated in the
head and generated stylesheet; those existing rules remain to preserve pre-script
editor and learner behavior.
The initializer couples asset diagnostics to carousel recreation and stores only
part of the cleanup lifecycle. The answers/checked maps admit combinations that
should not exist, such as checked without a selection. No persistent learner or
gradebook state exists; the refactor does not introduce either.

`brightspace-core-bundle.js` is a supplied third-party artifact, containing D2L
components and their dependencies. It is retained as an unused input file; the
project does not import, rewrite or distribute it. Instead,
`src/adapters/registerBrightspace.ts` imports the four required components directly
from `@brightspace-ui/core`. Vite resolves npm dependencies and bundles the
necessary components, icon data and language resources into a separate IIFE.
This also isolates third-party module names without manually wrapping or editing
vendor files. Vite generates package version and license attribution for that output.

## Boundaries and actual patterns

- **Strategy:** `AnswerStrategy` is injected into `QuizSession`.
  `MultipleChoiceStrategy` produces a typed evaluation independently of the
  controller and DOM. A different evaluator can be supplied without changing
  navigation or input handling. New input types will also need explicit domain
  variants and corresponding views; this is an extension point, not a claim that
  arbitrary question types work already.
- **Observer:** `QuizEventEmitter<QuizChange>` provides typed, synchronous
  subscriptions. The session publishes immutable snapshots; the controller
  coordinates the view, counter, indicators, focus and live region from those
  changes. Selection updates only Check availability, preserving native radio
  focus and arrow-key behavior. Subscriptions have explicit unsubscribe/disposal.
- **Adapter and creation methods:** `BrightspaceAdapter` owns custom/native
  button creation, instruction-panel creation and Lit's asynchronous focus
  contract. Feedback presentation chooses its compatible wrapper using the same
  adapter capability. These small factory functions/methods address concrete
  markup variation; a separate Factory Method inheritance hierarchy or Abstract
  Factory would add indirection without another coherent UI family to justify it.
- **Typed state transitions:** the `Attempt` union makes unanswered, selected
  and graded states explicit. `QuizSession` guards transitions and computes
  answering/feedback/completed phases. A hierarchy of State objects would add
  complexity to these simple transitions, so it is intentionally not used.
  Completion means every question has been checked; it adds no new learner UI.
- **Dependency injection/composition:** initialization creates the strategy,
  session, adapter, view and controller. Constructors receive their collaborators.
  Parsers receive source elements; domain and session logic use no DOM globals.

| Current attempt | Command               | Result                                         |
| --------------- | --------------------- | ---------------------------------------------- |
| Unanswered      | Select valid answer   | Selected                                       |
| Unanswered      | Check                 | No change                                      |
| Selected        | Select valid answer   | Selected, updated choice                       |
| Selected        | Check                 | Graded with evaluation                         |
| Graded          | Select or Check       | No change                                      |
| Any             | Try Again             | Unanswered for current question                |
| Any             | Valid navigation      | Current index changes, attempts preserved      |
| Any             | Restart (session API) | All attempts cleared, first question           |
| Any             | Dispose               | Observers cleared, further transitions ignored |

The controller delegates change/click events at the mount root rather than
rebinding every rendered descendant. Native radio keyboard behavior remains
native. Safe rich HTML enters the views only through the parser's sanitizer;
plain labels/attributes are escaped. No authored source nodes are moved or edited
while parsing. Diagnostics use `textContent`.

## Function mapping

| Major original function/state                                              | New location                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `normalizeText`, `cleanClone`, `richHTML`, `answerFromListItem`, `between` | `src/parsers/richContent.ts`                                        |
| `parseQuestion`, `tableAnswerList`, `parseQuestionTable`, `parseQuestions` | `src/parsers/QuizParser.ts`                                         |
| Prompt/feedback/answer/marker semantic rules                               | `src/parsers/QuizValidator.ts`                                      |
| Carousel `state`, `checked`, reset and `go`                                | `src/application/QuizSession.ts` and `src/domain/models.ts`         |
| Inline correctness calculation                                             | `src/strategies/MultipleChoiceStrategy.ts`                          |
| `button`, `renderInstructions`, Lit focus waiting                          | `src/adapters/BrightspaceAdapter.ts`                                |
| `renderOptions`                                                            | `src/views/QuestionView.ts`                                         |
| `renderFeedback`                                                           | `src/views/FeedbackView.ts`                                         |
| `renderDots`                                                               | `src/views/CarouselView.ts`                                         |
| Outer `render`, live region, focus helpers                                 | `src/views/QuizView.ts`                                             |
| `bind`, answer/check/reset/navigation handlers                             | `src/application/QuizController.ts`                                 |
| `esc`, `word`                                                              | `src/utils/markup.ts`                                               |
| `inEditor`, `initialize`, mounted WeakMap, diagnostics and asset warnings  | `src/application/initialize.ts`                                     |
| Document startup                                                           | `src/main.ts`                                                       |
| Generated inline quiz styling                                              | `src/styles/quiz.css`; startup CSS remains inline in authoring HTML |
| Bundle/font/language integration                                           | `scripts/prepare-assets.mjs`, `vite.config.ts`, `NOTICE.md`         |

## Build and lifecycle

[Vite library mode](https://vite.dev/guide/build#library-mode) emits two classic
IIFEs with fixed names: `assets/brightspace-components.js` from npm component
imports, followed by `assets/native-quiz.js` from application source. Inlining
dynamic imports includes language dictionaries and icons in the component script
rather than leaving runtime imports or relying on a course's folder structure.
Keeping the component script separate allows native quiz fallback when its
request fails. No component implementation is modified.

A small build plugin copies the editable source HTML, inlines the original quiz
stylesheet (with font paths adjusted for the HTML location), and replaces both
development module entries with ordered deferred classic scripts. Production has
no bare imports, Vite client, source imports, or dependency on the supplied bundle.
`verify-build.mjs` checks these invariants, dictionary inclusion, notices and the
unchanged authored table. Strict TypeScript checks include unchecked-index and
exact optional property checks. [Vitest's jsdom environment](https://vitest.dev/guide/environment)
tests the DOM boundary separately from real-browser checks.

A full mount cleanup is stored per root. It removes delegated listeners, state
subscriptions, live regions, warnings, editor observers, focus/pagehide listeners
and the ready flag. Async focus work checks connectivity before focusing. Editor attribute changes and focus entering an editing document
tear down the learner UI. Fresh initialization can mount the saved source again.
`designMode` is checked on initialization and focus; there is no polling timer.
The startup CSS independently reveals authoring content using `:read-write` even
when an editor does not execute scripts. HMR disposes the old mount. Pagehide
cleans the mount and pageshow restores it from the HTML when using browser history.

A missing npm component script selects native buttons/details/aside. Language
resources are part of that script, so they cannot fail as separate production
requests. Loading failure messages, font fallbacks and reduced-motion rules remain
available. The original external
course theme is outside this repository and requires a target-course smoke check.
