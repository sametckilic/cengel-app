# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Development cadence

- Work in small, reviewable increments and stop for user feedback after each increment.
- Preserve the current visual language and existing behavior unless the active increment explicitly changes them.
- Run `npm run lint` and `npx tsc --noEmit` after every code increment.
- When clue catalog, puzzle recipes, or generator code changes, also run `npm run dataset:check`, `npm run test:generator`, and `npm run puzzles:check`.
- Do not start a later roadmap phase while the current phase is awaiting user review.
- For `datasets/crossword_clues_gameplay_ready.jsonl`, the project owner confirmed that all questions are project-owned and `commercial_use_allowed` is only a legacy/default value. Ignore that field for this file only; do not generalize the exception to other datasets.

# Product direction

Build one complete, local-first puzzle flow before adding more screens or product features. The first vertical slice is complete when a puzzle can be selected, solved, resumed after an app restart, and shown with accurate progress elsewhere in the app.

Puzzle generation must not assume an 8x8 or square grid. Every generation request must explicitly carry row count, column count, difficulty, categories, target word count, and a deterministic seed. Generated puzzle definitions must retain those dimensions and metadata so the UI can present multiple sizes, difficulties, and categories.

Unused layout positions must blend into the canvas and must never appear as black block squares. Themed puzzle categories express emphasis rather than an exclusive filter: a themed recipe must define a category weight above 50%, guarantee that at least that share of its final words comes from the named categories, and allow the remainder to come from other categories at the same difficulty.

Implementation order:

1. Define a typed puzzle data model and move puzzle content out of presentation components.
2. Build deterministic, validated puzzle definitions of variable dimensions, difficulties, and categories from the project-owned clue catalog; never load the source JSONL in the Expo runtime.
3. Add an ID-based puzzle route and load the selected puzzle from the shared data source.
4. Implement the complete puzzle engine: word and cell selection, direction changes at intersections, Turkish input, backspace behavior, answer validation, locking, hints, and completion.
5. Persist progress locally behind a storage abstraction. Prefer Expo SQLite for the mobile-first implementation; account for its SDK 54 web limitations if production web support is required.
6. Connect the home, archive, and pack screens to the shared puzzle catalog and real progress state.
7. Add focused engine tests and verify the experience on Android, iOS, and web before profile, premium, backend, or additional content work.
