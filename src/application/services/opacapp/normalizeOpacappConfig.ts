import type {
  OpacappAuthHint,
  OpacappConfigSource,
  OpacappNormalizationIssue,
  OpacappNormalizedProvider,
  OpacappRawConfig,
} from '@/src/domain/models/opacapp';

const BASE_URL_KEYS = ['baseurl', 'baseUrl', 'baseURL', 'url', 'URL'];

const SRU_HINT_KEYS = ['sru', 'sruBaseUrl', 'sru_baseurl', 'sru_baseUrl', 'sru_url'];

const API_HINTS_SRU = new Set(['sru', 'srw', 'primo-sru']);

const API_HINTS_OPAC = new Set([
  'adis',
  'aleph',
  'alma',
  'bibliotheca',
  'koha',
  'lbs',
  'open',
  'pica',
  'primo',
  'sierra',
  'sisis',
  'symphony',
  'touchpoint',
  'webopac.net',
]);

const toStringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const getDataField = (data: Record<string, unknown> | undefined, keys: string[]) => {
  if (!data) return undefined;
  for (const key of keys) {
    const direct = toStringValue(data[key]);
    if (direct) return direct;
  }
  return undefined;
};

const inferAuthHint = (config: OpacappRawConfig, baseUrl: string): OpacappAuthHint => {
  const api = typeof config.api === 'string' ? config.api.toLowerCase() : '';
  const data = config.data ?? {};

  if (API_HINTS_SRU.has(api) || SRU_HINT_KEYS.some((key) => typeof data[key] === 'string')) {
    return 'sru';
  }

  if (typeof config.account_supported === 'boolean') {
    return config.account_supported ? 'opac' : 'none';
  }

  if (API_HINTS_OPAC.has(api)) {
    return 'opac';
  }

  if (baseUrl.toLowerCase().includes('sru') || baseUrl.toLowerCase().includes('srw')) {
    return 'sru';
  }

  return 'unknown';
};

export type NormalizeOpacappConfigResult = {
  provider: OpacappNormalizedProvider | null;
  issues: OpacappNormalizationIssue[];
};

export const normalizeOpacappConfig = (
  raw: OpacappRawConfig,
  source: OpacappConfigSource,
): NormalizeOpacappConfigResult => {
  const issues: OpacappNormalizationIssue[] = [];
  const api = toStringValue(raw.api);
  const title = toStringValue(raw.title);
  const baseUrl = getDataField(raw.data, BASE_URL_KEYS);

  if (!api) issues.push({ field: 'api', message: 'Missing api string' });
  if (!title) issues.push({ field: 'title', message: 'Missing title string' });
  if (!baseUrl) issues.push({ field: 'data.baseurl', message: 'Missing base URL in data' });

  if (!api || !title || !baseUrl) {
    return { provider: null, issues };
  }

  const id =
    typeof raw.library_id === 'number' || typeof raw.library_id === 'string'
      ? String(raw.library_id)
      : source.file.replace(/\.json$/i, '');

  const location = raw.city || raw.state || raw.country || raw.geo ? {
    city: toStringValue(raw.city),
    state: toStringValue(raw.state),
    country: toStringValue(raw.country),
    geo: Array.isArray(raw.geo) && raw.geo.length === 2 ? (raw.geo as [number, number]) : undefined,
  } : undefined;

  const authHint = inferAuthHint(raw, baseUrl);

  return {
    provider: {
      id,
      title,
      api,
      baseUrl,
      authHint,
      location,
      accountSupported: typeof raw.account_supported === 'boolean' ? raw.account_supported : undefined,
      source,
    },
    issues,
  };
};
