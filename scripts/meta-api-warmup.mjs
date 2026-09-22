#!/usr/bin/env node
/**
 * Generate successful Meta Marketing API calls through the datavessel CLI.
 *
 * Why: Meta grants an app the "Full" Marketing API access tier only after it
 * has made 500+ Marketing API calls in the past 15 days with an error rate
 * under 15% over the last 500 calls. Until then the app is on the
 * development tier and can only read ad accounts of users who hold a role
 * on the app (everyone else gets Graph error 270).
 *
 * This script rotates through the read-only meta_* tools against one ad
 * account, paced so it stays inside Meta's development-tier rate limits
 * (per ad account, per rolling hour: ~300 ads-management calls and ~600
 * ads-insights calls when the account has no active ads).
 *
 * Usage (needs DATAVESSEL_API_KEY or a logged-in CLI profile):
 *   node scripts/meta-api-warmup.mjs [--calls 250] [--interval-ms 10000]
 *                                     [--ad-account-id act_123]
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const TOTAL = Number(arg('--calls', '250'));
const INTERVAL_MS = Number(arg('--interval-ms', '10000'));
let adAccountId = arg('--ad-account-id', '');

function run(tool, params = {}) {
  const args = [CLI, '--json', 'run', tool];
  for (const [k, v] of Object.entries(params)) args.push(`--${k}`, String(v));
  const res = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const out = res.stdout || '';
  // The CLI prints the JSON payload followed by a "✓ Executed" line.
  const jsonEnd = out.lastIndexOf('\n✓');
  const body = jsonEnd >= 0 ? out.slice(0, jsonEnd) : out;
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    data = undefined;
  }
  const ok = res.status === 0 && data !== undefined && !data?.error;
  return { ok, data, stderr: (res.stderr || '').trim() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Discover an ad account plus one campaign / ad set / ad to hang reads off.
if (!adAccountId) {
  const r = run('meta_get_user_ad_accounts');
  if (!r.ok || !r.data.adAccounts?.length) {
    console.error('Could not list ad accounts:', r.stderr || JSON.stringify(r.data));
    process.exit(1);
  }
  adAccountId = r.data.adAccounts[0].id;
}
const campaign = run('meta_list_campaigns', { 'ad-account-id': adAccountId, limit: 1 }).data?.campaigns?.[0];
const adSet = run('meta_list_ad_sets', { 'ad-account-id': adAccountId, limit: 1 }).data?.adSets?.[0];
const ad = run('meta_list_ads', { 'ad-account-id': adAccountId, limit: 1 }).data?.ads?.[0];

// Insights endpoints have their own (larger) rate budget, so most of the
// rotation goes there; management reads are kept to ~40% of the mix.
const acct = { 'ad-account-id': adAccountId };
const rotation = [
  ['meta_get_account_insights', { ...acct, 'date-preset': 'last_7d' }],
  ['meta_get_ad_account_info', acct],
  ['meta_get_account_insights', { ...acct, 'date-preset': 'last_30d' }],
  ['meta_list_campaigns', acct],
  ['meta_get_product_performance', acct],
  campaign && ['meta_get_campaign_insights', { 'campaign-id': campaign.id, 'date-preset': 'last_7d' }],
  campaign && ['meta_get_campaign_info', { 'campaign-id': campaign.id }],
  adSet && ['meta_get_ad_set_insights', { 'ad-set-id': adSet.id, 'date-preset': 'last_7d' }],
  ['meta_get_account_insights', { ...acct, 'date-preset': 'yesterday' }],
  adSet && ['meta_get_ad_set_info', { 'ad-set-id': adSet.id }],
  ad && ['meta_get_ad_insights', { 'ad-id': ad.id, 'date-preset': 'last_7d' }],
  ad && ['meta_get_ad_info', { 'ad-id': ad.id }],
  ['meta_get_account_insights', { ...acct, 'date-preset': 'this_month' }],
  ['meta_get_user_ad_accounts', {}],
].filter(Boolean);

console.log(`Warm-up: ${TOTAL} calls against ${adAccountId}, one every ${INTERVAL_MS} ms (~${Math.round((3600000 / INTERVAL_MS) * 10) / 10}/hour)`);

let ok = 0;
let failed = 0;
let consecutiveFailures = 0;
const started = Date.now();
for (let i = 0; i < TOTAL; i++) {
  const [tool, params] = rotation[i % rotation.length];
  const r = run(tool, params);
  if (r.ok) {
    ok++;
    consecutiveFailures = 0;
  } else {
    failed++;
    consecutiveFailures++;
    console.error(`  ✗ ${tool}: ${r.stderr || JSON.stringify(r.data)}`);
  }
  if ((i + 1) % 10 === 0 || i === TOTAL - 1) {
    const mins = Math.round((Date.now() - started) / 60000);
    console.log(`  ${i + 1}/${TOTAL} — ok ${ok}, failed ${failed} (${mins} min)`);
  }
  // Errors count against Meta's error-rate threshold; stop rather than
  // pile them up (rate limit, expired token, ...).
  if (consecutiveFailures >= 5) {
    console.error('5 consecutive failures — stopping.');
    process.exit(2);
  }
  if (i < TOTAL - 1) await sleep(INTERVAL_MS);
}
console.log(`Done: ${ok} successful, ${failed} failed.`);
process.exit(failed > ok ? 1 : 0);
