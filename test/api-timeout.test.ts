import { test } from 'node:test';
import assert from 'node:assert/strict';

import { executeTimeoutMs } from '../src/api.js';

const DEFAULT = 60_000;

test('no wait_seconds → default timeout', () => {
  assert.equal(executeTimeoutMs(DEFAULT, {}), DEFAULT);
  assert.equal(executeTimeoutMs(DEFAULT, { property_id: '123' }), DEFAULT);
});

test('wait_seconds rides on top of the default budget', () => {
  assert.equal(executeTimeoutMs(DEFAULT, { wait_seconds: 45 }), DEFAULT + 45_000);
  assert.equal(executeTimeoutMs(DEFAULT, { wait_seconds: 120 }), DEFAULT + 120_000);
});

test('string values coerce (escape-hatch params arrive as strings)', () => {
  assert.equal(executeTimeoutMs(DEFAULT, { wait_seconds: '90' }), DEFAULT + 90_000);
});

test('garbage, zero, and negative values fall back to the default', () => {
  assert.equal(executeTimeoutMs(DEFAULT, { wait_seconds: 'soon' }), DEFAULT);
  assert.equal(executeTimeoutMs(DEFAULT, { wait_seconds: 0 }), DEFAULT);
  assert.equal(executeTimeoutMs(DEFAULT, { wait_seconds: -5 }), DEFAULT);
  assert.equal(executeTimeoutMs(DEFAULT, { wait_seconds: Infinity }), DEFAULT);
});

test('wait is clamped to 10 minutes', () => {
  assert.equal(executeTimeoutMs(DEFAULT, { wait_seconds: 99_999 }), DEFAULT + 600_000);
});
