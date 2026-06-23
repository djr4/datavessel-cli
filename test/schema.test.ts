import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toKebab,
  schemaToParams,
  collectParams,
  type ObjectSchema,
} from '../src/schema.js';

test('toKebab handles camelCase, snake_case and odd chars', () => {
  assert.equal(toKebab('propertyId'), 'property-id');
  assert.equal(toKebab('start_date'), 'start-date');
  assert.equal(toKebab('HTTPServer'), 'http-server');
  assert.equal(toKebab('already-kebab'), 'already-kebab');
});

const schema: ObjectSchema = {
  type: 'object',
  properties: {
    propertyId: { type: 'string', description: 'GA property' },
    limit: { type: 'integer' },
    ratio: { type: 'number' },
    active: { type: 'boolean' },
    metrics: { type: 'array', items: { type: 'string' } },
    filter: { type: 'object' },
    mode: { type: 'string', enum: ['a', 'b'] },
  },
  required: ['propertyId'],
};

test('schemaToParams derives flags, types and required flags', () => {
  const params = schemaToParams(schema);
  const byProp = Object.fromEntries(params.map((p) => [p.prop, p]));
  assert.equal(byProp.propertyId.flag, 'property-id');
  assert.equal(byProp.propertyId.attr, 'propertyId');
  assert.equal(byProp.propertyId.required, true);
  assert.equal(byProp.limit.type, 'integer');
  assert.equal(byProp.metrics.type, 'array');
  assert.equal(byProp.metrics.itemType, 'string');
  assert.equal(byProp.active.required, false);
});

test('collectParams coerces values by type', () => {
  const params = schemaToParams(schema);
  const out = collectParams(params, {
    propertyId: '123',
    limit: '10',
    ratio: '0.5',
    active: true,
    metrics: ['sessions', 'users'],
    filter: '{"x":1}',
    mode: 'a',
  });
  assert.deepEqual(out, {
    propertyId: '123',
    limit: 10,
    ratio: 0.5,
    active: true,
    metrics: ['sessions', 'users'],
    filter: { x: 1 },
    mode: 'a',
  });
});

test('collectParams enforces required options', () => {
  const params = schemaToParams(schema);
  assert.throws(() => collectParams(params, { limit: '5' }), /Missing required option/);
});

test('collectParams rejects non-integer integers', () => {
  const params = schemaToParams(schema);
  assert.throws(
    () => collectParams(params, { propertyId: 'x', limit: '1.5' }),
    /must be an integer/,
  );
});

test('escape-hatch params override schema flags', () => {
  const params = schemaToParams(schema);
  const out = collectParams(params, { propertyId: '123' }, { propertyId: 'override' });
  assert.equal(out.propertyId, 'override');
});

test('null input schema yields no params', () => {
  assert.deepEqual(schemaToParams(null), []);
});
