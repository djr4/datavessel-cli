/**
 * Pure helpers for `datavessel setup`: response parsing and the memory entry
 * the wizard persists. Kept free of I/O so they're unit-testable.
 */

/**
 * Tags on the saved setup profile. Team leads recall `tags: ["team:<x>"]`,
 * and recall matches entries whose tag array CONTAINS the requested tags
 * (`tags @> filter` server-side) — so one entry carrying every team tag is
 * found by all three leads' first-phase recall.
 */
export const SETUP_MEMORY_TAGS = [
  'business-profile',
  'setup',
  'team:operator',
  'team:marketing',
  'team:builder',
] as const;

export interface SetupAnswers {
  ga4PropertyId?: string;
  gscSiteUrl?: string;
  storePlatform?: string;
  storeUrl?: string;
  slackChannel?: string;
  notes?: string;
}

/** "3" → 3 when within [1, count]; anything else (incl. empty) → undefined. */
export function parseChoice(answer: string, count: number): number | undefined {
  const n = Number.parseInt(answer.trim(), 10);
  if (!Number.isInteger(n) || n < 1 || n > count) return undefined;
  return n;
}

export interface GaPropertyOption {
  id: string;
  label: string;
}

/**
 * Parse `get_account_summaries` output into pickable GA4 properties. The GA
 * Admin API shape is accountSummaries[].propertySummaries[].property
 * ("properties/123"); the backend may return it under `account_summaries` or
 * as a bare array, so both are handled and anything unrecognized yields [].
 */
export function parseGaProperties(data: unknown): GaPropertyOption[] {
  const root = data as Record<string, unknown> | unknown[] | null;
  const summaries = Array.isArray(root)
    ? root
    : ((root?.account_summaries ?? (root as Record<string, unknown> | null)?.accountSummaries) as unknown);
  if (!Array.isArray(summaries)) return [];

  const options: GaPropertyOption[] = [];
  for (const account of summaries) {
    if (!account || typeof account !== 'object') continue;
    const acc = account as {
      displayName?: string;
      display_name?: string;
      propertySummaries?: Array<{ property?: string; displayName?: string; display_name?: string }>;
      property_summaries?: Array<{ property?: string; displayName?: string; display_name?: string }>;
    };
    const accountName = acc.displayName ?? acc.display_name ?? 'Unnamed account';
    const props = acc.propertySummaries ?? acc.property_summaries;
    if (!Array.isArray(props)) continue;
    for (const p of props) {
      if (!p?.property) continue;
      const id = p.property.replace(/^properties\//, '');
      options.push({
        id,
        label: `${p.displayName ?? p.display_name ?? id} — ${accountName}`,
      });
    }
  }
  return options;
}

/**
 * Parse `list_sites` output into site URLs. Search Console returns
 * siteEntry[].siteUrl; tolerate bare arrays of strings/objects too.
 */
export function parseGscSites(data: unknown): string[] {
  const root = data as Record<string, unknown> | unknown[] | null;
  const entries = Array.isArray(root)
    ? root
    : ((root?.siteEntry ?? (root as Record<string, unknown> | null)?.sites) as unknown);
  if (!Array.isArray(entries)) return [];

  const sites: string[] = [];
  for (const entry of entries) {
    if (typeof entry === 'string') sites.push(entry);
    else if (entry && typeof entry === 'object') {
      const e = entry as { siteUrl?: string; site_url?: string; url?: string };
      const url = e.siteUrl ?? e.site_url ?? e.url;
      if (url) sites.push(url);
    }
  }
  return sites;
}

/**
 * The memory entry content. Team leads read this verbatim during recall, so
 * it names each fact the way the lead templates and member input schemas do
 * (property_id, site_url, shop URL, Slack channel).
 */
export function buildSetupMemoryContent(answers: SetupAnswers): string {
  const parts: string[] = [
    'Business setup profile (saved by `datavessel setup`; use these as member inputs and defaults):',
  ];
  if (answers.storePlatform) parts.push(`- Store platform: ${answers.storePlatform}`);
  if (answers.storeUrl) parts.push(`- Store URL (shop_url): ${answers.storeUrl}`);
  if (answers.ga4PropertyId) parts.push(`- GA4 property_id: ${answers.ga4PropertyId}`);
  if (answers.gscSiteUrl) parts.push(`- Search Console site_url: ${answers.gscSiteUrl}`);
  if (answers.slackChannel) parts.push(`- Slack report channel: ${answers.slackChannel}`);
  if (answers.notes) parts.push(`- Notes from the owner: ${answers.notes}`);
  if (parts.length === 1) parts.push('- (nothing configured yet — discover context at runtime)');
  return parts.join('\n');
}
