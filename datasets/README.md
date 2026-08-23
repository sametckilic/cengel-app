# Crossword clue dataset

`crossword_clues_gameplay_ready.jsonl` is a clue-answer pool, not a collection of completed crossword grids. Keep the source file outside the Expo runtime bundle and process it with the project script.

## Validation

Run:

```sh
npm run dataset:check
```

The command validates every JSONL row, checks normalized Turkish answers and answer lengths, applies the gameplay quality filters, and reports both quality and commercially eligible counts.

## Catalog generation

The project owner confirmed on 2026-08-19 that every question in this specific dataset is project-owned. The `commercial_use_allowed` field is a legacy/default value and is intentionally ignored for this file. This exception does not apply to other datasets.

Generate the compact runtime catalog with:

```sh
npm run dataset:build
```

The generated catalog records the project-ownership basis at catalog level and omits legacy licensing fields from runtime entries.
