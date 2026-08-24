import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  checksumJson,
  jsonValuesEqual,
} from '../src/canonical-json';

describe('canonical JSON identity', () => {
  it('ignores object key order at every nesting level', () => {
    const left = {
      cells: [{ row: 1, column: 2 }],
      id: 'gunun-2026-08-31',
    };
    const right = {
      id: 'gunun-2026-08-31',
      cells: [{ column: 2, row: 1 }],
    };

    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(checksumJson(left)).toBe(checksumJson(right));
    expect(jsonValuesEqual(left, right)).toBe(true);
  });

  it('retains array order and value differences', () => {
    expect(jsonValuesEqual({ values: ['A', 'B'] }, { values: ['B', 'A'] })).toBe(
      false,
    );
  });
});
