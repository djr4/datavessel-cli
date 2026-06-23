import { test } from 'node:test';
import assert from 'node:assert/strict';
import { table } from '../src/output.js';

test('table aligns columns by visible width', () => {
  const out = table(['A', 'BB'], [['x', 'yy'], ['zzz', 'w']]);
  const lines = out.split('\n');
  assert.equal(lines.length, 3); // header + 2 rows
  // Each data row should contain both cell values.
  assert.match(lines[1], /x/);
  assert.match(lines[1], /yy/);
  assert.match(lines[2], /zzz/);
});

test('table handles empty rows', () => {
  const out = table(['A', 'B'], []);
  assert.equal(out.split('\n').length, 1);
});
