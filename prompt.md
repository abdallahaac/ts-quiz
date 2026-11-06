ou are a senior TypeScript software architect specializing in SOLID principles, object-oriented programming, modular architecture, and Gang of Four design patterns.

I have provided two files:

An HTML file containing my custom Brightspace multiple-choice quiz, including the authoring interface, styling, JavaScript logic, parser, carousel, and learner interactions.

brightspace-core-bundle.js, which contains bundled Brightspace UI components and third-party dependencies.

Objective
Completely refactor my custom quiz implementation into a clean, modular, maintainable TypeScript architecture using Vite.

I want an actual implementation, not merely architectural suggestions.

The existing quiz must remain functionally and visually equivalent to the original.

1. Analyze the existing implementation
   Before modifying anything, identify and explain the responsibilities of the current code, including:

Brightspace HTML authoring and question-table parsing

Question validation and diagnostics

Quiz initialization and editor-mode detection

Quiz state management

Multiple-choice answer selection and evaluation

Carousel navigation and progress indicators

Feedback generation and presentation

DOM rendering and event handling

Brightspace UI component integration and fallbacks

Accessibility and keyboard interactions

CSS styling and asset loading

Identify any duplicated logic, excessive coupling, global state, or violations of the Single Responsibility Principle.

Distinguish application source code from generated assets and third-party dependencies. Do not directly refactor or rewrite the bundled Brightspace UI implementation. Preserve its licensing and integration requirements.

2. Convert the application to TypeScript
   Use strict TypeScript with:

Explicit domain models and interfaces

Clearly defined module boundaries

Proper typing for DOM elements and events

Type-safe quiz state and navigation

Discriminated unions where appropriate

Dependency injection when beneficial

Minimal use of any

ES module imports and exports

Do not simply rename JavaScript files to .ts. Improve the architecture through genuine separation of responsibilities.

3. Apply appropriate design patterns
   Evaluate and implement patterns where they solve actual architectural problems.

Consider:

Strategy Pattern

Encapsulate answer-evaluation algorithms.

Allow future question types to implement different grading strategies without modifying the main quiz controller.

Factory Method / Abstract Factory

Encapsulate creation of question components, feedback components, and Brightspace-compatible UI elements.

Use Abstract Factory only if multiple coherent families of components genuinely justify it.

Observer Pattern

Decouple quiz state changes from rendering, navigation indicators, and progress updates.

Implement typed subscriptions and cleanup.

State Pattern

Model meaningful quiz lifecycle transitions, such as initialization, answering, feedback, completion, and restart, if this simplifies existing logic.

Adapter Pattern

Isolate integration with Brightspace custom elements and any fallback native HTML controls.

Dependency Injection

Allow components and services to receive dependencies through constructors or explicit factory functions rather than referencing unrelated modules or global objects.

Use composition over inheritance where appropriate.

Do not force every design pattern into the architecture. Document why each selected pattern is appropriate.

4. Proposed modular structure
   Establish a maintainable structure similar to:

src/
├── main.ts
├── domain/
│ ├── models/
│ ├── interfaces/
│ └── types/
├── application/
│ ├── QuizController.ts
│ ├── QuizSession.ts
│ └── QuizState.ts
├── parsers/
│ ├── QuizParser.ts
│ └── QuizValidator.ts
├── strategies/
│ └── MultipleChoiceStrategy.ts
├── factories/
│ └── ComponentFactory.ts
├── adapters/
│ └── BrightspaceAdapter.ts
├── views/
│ ├── QuizView.ts
│ ├── QuestionView.ts
│ ├── CarouselView.ts
│ └── FeedbackView.ts
├── events/
│ └── QuizEventEmitter.ts
├── styles/
│ └── quiz.scss
└── utils/
Treat this as a proposed structure, not a mandatory collection of classes. Consolidate modules where separation would introduce unnecessary complexity.

5. Preserve Brightspace compatibility
   The application must continue to operate as standalone HTML content within D2L Brightspace Manage Files.

Preserve:

The existing editable HTML question table

Authoring through Brightspace Design View / HTML editor

The [CORRECT] answer convention

Parsing and validation of author-authored questions

All existing carousel navigation functionality

Feedback and answer-selection behaviour

D2L component integration and native HTML fallbacks

Existing visual appearance, Lato typography, and styling

Accessibility semantics, keyboard navigation, ARIA announcements, and reduced-motion support

Cleanup of event listeners and observers

Detection of Brightspace editing mode

Do not require course authors to modify TypeScript, JSON, or application source code to add questions.

The HTML question table must remain the source of truth for authored content.

Avoid introducing runtime assumptions that break when files are deployed to a Brightspace course folder.

6. Configure Vite
   Create a proper Vite + TypeScript project supporting:

Modular source code during development

Strict type checking

Development and production builds

A standalone production JavaScript bundle suitable for Brightspace

Predictable local asset paths

No reliance on bare module imports in the deployed HTML

No unnecessary framework dependencies

Preserve the original authoring HTML experience while moving application logic into TypeScript source modules.

If necessary, configure Vite library mode or an appropriate bundling strategy to produce a browser-compatible classic script.

7. Testing and quality assurance
   Add meaningful automated tests using Vitest for:

Parsing valid and invalid authoring tables

Empty or incomplete question rows

Correct and incorrect answer selection

State transitions

Carousel navigation boundaries

Feedback generation

Component fallbacks

Initialization and cleanup

Test critical Brightspace authoring and learner-mode behaviour.

Avoid changes that introduce accessibility regressions.

8. Implementation requirements
   Work directly on the supplied project/source.

Inspect and explain the original architecture.

Establish the new TypeScript structure.

Implement the refactor incrementally.

Preserve the existing behaviour and CSS.

Configure the development and production build.

Add automated tests.

Verify type checking, tests, and build output.

Provide the complete final project, including configuration and deployment instructions.

Do not leave placeholder classes, incomplete methods, pseudocode, or TODO implementations.

Do not remove functionality to simplify the architecture.

Do not replace my quiz with a newly designed application.

The goal is to improve internal code organization, extensibility, testability, and maintainability without changing the existing user experience.

Final deliverables
Provide:

Fully implemented modular TypeScript source

Updated project directory structure

package.json, tsconfig.json, and Vite configuration

Working production build

Updated Brightspace-compatible HTML

Automated tests

A concise explanation of the design patterns actually implemented

A mapping from major original functions to their new modules

Instructions for local development and Brightspace deployment

Prioritize correctness, simplicity, and maintainability over architectural complexity.

Success criterion: I should be able to edit a question in the Brightspace HTML table, save the page, and have the refactored TypeScript-based quiz behave exactly as the original did.
