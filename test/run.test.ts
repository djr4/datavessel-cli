import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRawFlags } from '../src/commands/run.js';

test('parses scalar flags with space and equals forms', () => {
  const r = parseRawFlags(['--property-id', '123', '--limit=10']);
  assert.deepEqual(r.flags, { 'property-id': ['123'], limit: ['10'] });
  assert.deepEqual(r.params, {});
  assert.equal(r.wantsHelp, false);
});

test('repeated flags accumulate into an array', () => {
  const r = parseRawFlags(['--metrics', 'sessions', '--metrics', 'users']);
  assert.deepEqual(r.flags.metrics, ['sessions', 'users']);
});

test('boolean switch and negation', () => {
  const r = parseRawFlags(['--active', '--no-cache']);
  assert.equal(r.flags.active, true);
  assert.equal(r.flags.cache, false);
});

test('--param and --params-json populate escape-hatch params', () => {
  const r = parseRawFlags(['--param', 'a=1', '--params-json', '{"b":2}']);
  assert.deepEqual(r.params, { a: '1', b: 2 });
});

test('--help is detected', () => {
  const r = parseRawFlags(['--help']);
  assert.equal(r.wantsHelp, true);
});

test('positional (non-flag) tokens are rejected', () => {
  assert.throws(() => parseRawFlags(['oops']), /Unexpected argument/);
});

test('--params-json must be a JSON object', () => {
  assert.throws(() => parseRawFlags(['--params-json', '[1,2]']), /must be a JSON object/);
});
