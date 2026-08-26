# Crossword clue dataset

`crossword_clues_gameplay_ready.jsonl` is a clue-answer pool, not a collection of completed crossword grids. Keep the source file outside the Expo runtime bundle and process it with the project script.

## Validation

Run:

```sh
npm run dataset:check
```

The command validates every JSONL row, checks normalized Turkish answers and answer lengths, and reports the gameplay-ready catalog coverage.

## Catalog generation

The project owner confirmed on 2026-08-19 that every question in this specific dataset is project-owned. The `commercial_use_allowed` field is a legacy/default value and is intentionally ignored for this file. This exception does not apply to other datasets.

For the current content-growth phase, every row whose `gameplay_status` is `ready` is retained in the generated catalog. Score, fit, flag, and answer-length thresholds are intentionally disabled until the pool is large enough for editorial pruning. Multiple ready clue variants for the same normalized answer remain in the catalog; a generator may choose among them but must not place the same answer twice in one puzzle.

Generate the compact runtime catalog with:

```sh
npm run dataset:build
```

The generated catalog records the project-ownership basis at catalog level and omits legacy licensing fields from runtime entries.
