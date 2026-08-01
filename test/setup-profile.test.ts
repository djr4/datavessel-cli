import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChoice,
  parseGaProperties,
  parseGscSites,
  buildSetupMemoryContent,
  SETUP_MEMORY_TAGS,
} from '../src/setup-profile.js';

test('parseChoice accepts in-range numbers and rejects everything else', () => {
  assert.equal(parseChoice('2', 3), 2);
  assert.equal(parseChoice(' 1 ', 1), 1);
  assert.equal(parseChoice('', 3), undefined);
  assert.equal(parseChoice('0', 3), undefined);
  assert.equal(parseChoice('4', 3), undefined);
  assert.equal(parseChoice('abc', 3), undefined);
});

test('parseGaProperties handles the GA Admin API shape', () => {
  const props = parseGaProperties({
    account_summaries: [
      {
        displayName: 'Acme',
        propertySummaries: [
          { property: 'properties/123', displayName: 'Web' },
          { property: 'properties/456', displayName: 'App' },
        ],
      },
    ],
  });
  assert.deepEqual(props, [
    { id: '123', label: 'Web — Acme' },
    { id: '456', label: 'App — Acme' },
  ]);
});

test('parseGaProperties tolerates camelCase root, bare arrays, and junk', () => {
  assert.equal(
    parseGaProperties({
      accountSummaries: [{ display_name: 'A', property_summaries: [{ property: 'properties/9' }] }],
    })[0].id,
    '9',
  );
  assert.deepEqual(parseGaProperties(null), []);
  assert.deepEqual(parseGaProperties({ nope: true }), []);
  assert.deepEqual(parseGaProperties([{ propertySummaries: 'not-an-array' }]), []);
});

test('parseGscSites handles siteEntry, bare arrays, and junk', () => {
  assert.deepEqual(
    parseGscSites({ siteEntry: [{ siteUrl: 'sc-domain:example.com' }, { siteUrl: 'https://a.com/' }] }),
    ['sc-domain:example.com', 'https://a.com/'],
  );
  assert.deepEqual(parseGscSites(['https://b.com/']), ['https://b.com/']);
  assert.deepEqual(parseGscSites({}), []);
});

test('buildSetupMemoryContent names facts the way member inputs do', () => {
  const content = buildSetupMemoryContent({
    storePlatform: 'shopware',
    storeUrl: 'https://shop.example.com',
    ga4PropertyId: '123',
    gscSiteUrl: 'sc-domain:example.com',
    slackChannel: '#ops',
    notes: 'DE-first shop',
  });
  assert.match(content, /property_id: 123/);
  assert.match(content, /site_url: sc-domain:example.com/);
  assert.match(content, /shop_url.*https:\/\/shop\.example\.com/);
  assert.match(content, /#ops/);
  assert.match(content, /DE-first shop/);
});

test('buildSetupMemoryContent degrades gracefully when empty', () => {
  assert.match(buildSetupMemoryContent({}), /discover context at runtime/);
});

test('setup memory tags cover every team lead', () => {
  for (const tag of ['team:operator', 'team:marketing', 'team:builder']) {
    assert.ok((SETUP_MEMORY_TAGS as readonly string[]).includes(tag));
  }
});
