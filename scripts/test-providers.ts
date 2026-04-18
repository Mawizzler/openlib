import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { SearchFlowService } from '@/src/application/services/opac/SearchFlowService';
import { normalizeProviderBaseUrl } from './provider-url-normalization';

const REGISTRY_PATH = path.join(process.cwd(), 'data', 'providers.registry.json');
const OUTPUT_DIR = path.join(process.cwd(), 'artifacts', 'provider-status');
const STATUS_JSON_PATH = path.join(OUTPUT_DIR, 'status.json');
const STATUS_MD_PATH = path.join(OUTPUT_DIR, 'status.md');

const REQUIRED_FIELDS = ['id', 'title', 'api', 'baseUrl'] as const;
const API_ALIASES: Record<string, string> = {
  winbiap: 'bibliotheca',
  webopacnet: 'webopac.net',
};

const supportedApis = new Set<string>([
  'sierra',
  'koha',
  'evergreen',
  'spydus',
  'alma',
  'vsmart',
  'bibliocommons',
  'pika',
  'open',
  'bibliotheca',
  'webopac.net',
]);

type ProviderRegistry = {
  providers?: ProviderEntry[];
};

type ProviderEntry = {
  id?: string;
  title?: string;
  api?: string;
  baseUrl?: string;
};

type ProviderStatus = {
  id: string | null;
  title: string | null;
  api: string | null;
  baseUrl: string | null;
  status: 'working' | 'partial' | 'failing';
  reason?: string;
  normalizationReasons?: string[];
  httpStatus?: number;
  elapsedMs?: number;
  missingFields?: string[];
  checkedAt: string;
  recordsCount?: number;
};

const timeoutMs = Number(process.env.PROVIDER_TEST_TIMEOUT_MS ?? '12000');
const concurrency = Number(process.env.PROVIDER_TEST_CONCURRENCY ?? '4');
const testQuery = process.env.PROVIDER_TEST_QUERY ?? 'harry potter';
const onlyProviderIds = new Set(
  (process.env.PROVIDER_TEST_ONLY_IDS ?? '')
    .split(',')
    .map((value: string) => value.trim())
    .filter((value: string) => value.length > 0),
);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeProviderApi = (api: string | undefined): string | null => {
  if (!isNonEmptyString(api)) {
    return null;
  }

  const normalized = api.trim().toLowerCase();
  return API_ALIASES[normalized] ?? normalized;
};

const validateProvider = (provider: ProviderEntry) => {
  const missing = REQUIRED_FIELDS.filter((key) => !isNonEmptyString(provider[key]));
  return {
    ok: missing.length === 0,
    missing,
  };
};

const withTimeout = async <T>(promise: Promise<T>, timeout: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${timeout}ms`)), timeout);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const probeUsableSearch = async (provider: OpacappNormalizedProvider) => {
  const service = new SearchFlowService();
  const started = Date.now();
  try {
    const result = await withTimeout(
      service.search(provider, {
        query: testQuery,
      }),
      timeoutMs,
    );
    const elapsedMs = Date.now() - started;
    const recordsCount = result.records.length;
    if (recordsCount > 0) {
      return {
        ok: true,
        elapsedMs,
        recordsCount,
        reason: `Usable search returned ${recordsCount} records for query "${testQuery}"`,
      };
    }
    return {
      ok: false,
      elapsedMs,
      recordsCount,
      reason: `No usable records for query "${testQuery}"`,
    };
  } catch (error) {
    return {
      ok: false,
      elapsedMs: Date.now() - started,
      reason: error instanceof Error ? error.message : 'Unknown search error',
    };
  }
};

const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let index = 0;

  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]);
    }
  });

  await Promise.all(workers);
  return results;
};

const buildMarkdown = (generatedAt: string, statuses: ProviderStatus[]) => {
  const groups: Record<ProviderStatus['status'], ProviderStatus[]> = {
    working: [],
    partial: [],
    failing: [],
  };

  for (const status of statuses) {
    groups[status.status].push(status);
  }

  const totals = {
    working: groups.working.length,
    partial: groups.partial.length,
    failing: groups.failing.length,
  };

  const lines = [
    '# Provider Status',
    '',
    `Generated: ${generatedAt}`,
    `Totals: ${statuses.length} providers`,
    `Working: ${totals.working}`,
    `Partial: ${totals.partial}`,
    `Failing: ${totals.failing}`,
    '',
  ];

  const pushGroup = (label: string, list: ProviderStatus[]) => {
    lines.push(`## ${label} (${list.length})`);
    if (list.length === 0) {
      lines.push('None');
      lines.push('');
      return;
    }
    for (const item of list) {
      const title = item.title ?? 'Unknown title';
      const api = item.api ? ` [${item.api}]` : '';
      const baseUrl = item.baseUrl ? ` - ${item.baseUrl}` : '';
      const reason = item.reason ? ` (${item.reason})` : '';
      lines.push(`- ${title}${api}${baseUrl}${reason}`);
    }
    lines.push('');
  };

  pushGroup('Working', groups.working);
  pushGroup('Partial', groups.partial);
  pushGroup('Failing', groups.failing);

  return `${lines.join('\n')}`;
};

const run = async () => {
  const registryRaw = await readFile(REGISTRY_PATH, 'utf-8');
  const registry = JSON.parse(registryRaw) as ProviderRegistry;
  const providers = registry.providers ?? [];

  const generatedAt = new Date().toISOString();

  const targetProviders = onlyProviderIds.size
    ? providers.filter((provider) => isNonEmptyString(provider.id) && onlyProviderIds.has(provider.id))
    : providers;

  const statuses: ProviderStatus[] = await mapLimit(targetProviders, concurrency, async (provider) => {
    const validation = validateProvider(provider);
    const baseUrlValue = isNonEmptyString(provider.baseUrl) ? provider.baseUrl : null;
    const normalization = baseUrlValue
      ? normalizeProviderBaseUrl(baseUrlValue)
      : { normalizedUrl: null, reasons: [] as string[] };
    const normalizedUrl = normalization.normalizedUrl;

    if (!validation.ok) {
      return {
        id: isNonEmptyString(provider.id) ? provider.id : null,
        title: isNonEmptyString(provider.title) ? provider.title : null,
        api: isNonEmptyString(provider.api) ? provider.api : null,
        baseUrl: baseUrlValue,
        status: 'failing',
        reason: 'Missing required fields',
        missingFields: validation.missing,
        checkedAt: new Date().toISOString(),
      } satisfies ProviderStatus;
    }

    if (!normalizedUrl) {
      return {
        id: provider.id ?? null,
        title: provider.title ?? null,
        api: provider.api ?? null,
        baseUrl: baseUrlValue,
        status: 'failing',
        reason: 'Invalid or unsupported base URL',
        normalizationReasons: normalization.reasons,
        checkedAt: new Date().toISOString(),
      } satisfies ProviderStatus;
    }

    const checkedAt = new Date().toISOString();
    const normalizedApi = normalizeProviderApi(provider.api);

    if (!normalizedApi || !supportedApis.has(normalizedApi)) {
      return {
        id: provider.id ?? null,
        title: provider.title ?? null,
        api: provider.api ?? null,
        baseUrl: normalizedUrl,
        status: 'partial',
        reason: `Unsupported adapter: ${provider.api ?? 'unknown'}`,
        normalizationReasons: normalization.reasons,
        checkedAt,
      } satisfies ProviderStatus;
    }

    const normalizedProvider: OpacappNormalizedProvider = {
      id: provider.id!,
      title: provider.title!,
      api: normalizedApi,
      baseUrl: normalizedUrl,
      authHint: 'opac',
      location: undefined,
      accountSupported: false,
      source: {
        repository: 'local',
        path: REGISTRY_PATH,
        file: path.basename(REGISTRY_PATH),
        ref: 'workspace',
      },
    };

    const probe = await probeUsableSearch(normalizedProvider);

    if (!probe.ok) {
      return {
        id: provider.id ?? null,
        title: provider.title ?? null,
        api: provider.api ?? null,
        baseUrl: normalizedUrl,
        status: 'failing',
        reason: probe.reason,
        normalizationReasons: normalization.reasons,
        elapsedMs: probe.elapsedMs,
        recordsCount: probe.recordsCount,
        checkedAt,
      } satisfies ProviderStatus;
    }

    return {
      id: provider.id ?? null,
      title: provider.title ?? null,
      api: provider.api ?? null,
      baseUrl: normalizedUrl,
      status: 'working',
      normalizationReasons: normalization.reasons,
      elapsedMs: probe.elapsedMs,
      recordsCount: probe.recordsCount,
      reason: probe.reason,
      checkedAt,
    } satisfies ProviderStatus;
  });

  const totals = {
    providers: targetProviders.length,
    working: statuses.filter((status) => status.status === 'working').length,
    partial: statuses.filter((status) => status.status === 'partial').length,
    failing: statuses.filter((status) => status.status === 'failing').length,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });

  const payload = {
    generatedAt,
    totals,
    timeoutMs,
    concurrency,
    testQuery,
    statusByProviderId: Object.fromEntries(statuses.filter((status) => status.id).map((status) => [status.id as string, status.status])),
    results: statuses,
  };

  await writeFile(STATUS_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  await writeFile(STATUS_MD_PATH, `${buildMarkdown(generatedAt, statuses)}\n`, 'utf-8');

  console.log(`Providers tested: ${totals.providers}`);
  console.log(`Working: ${totals.working}`);
  console.log(`Partial: ${totals.partial}`);
  console.log(`Failing: ${totals.failing}`);
  console.log(`Status JSON: ${STATUS_JSON_PATH}`);
  console.log(`Status MD: ${STATUS_MD_PATH}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
