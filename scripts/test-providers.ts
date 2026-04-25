import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { OpacSearchFailureKind } from '@/src/domain/models/opac';
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
  'sisis',
  'bibliotheca',
  'webopac.net',
  'primo',
  'adis',
  'iopac',
  'touchpoint',
  'vufind',
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
  classification?: 'usable_records' | 'deterministic_no_records';
  reason?: string;
  searchFailureKind?: OpacSearchFailureKind;
  searchFailureMessage?: string;
  normalizationReasons?: string[];
  rewrittenBaseUrl?: boolean;
  rewriteFromHost?: string;
  rewriteToHost?: string;
  httpStatus?: number;
  elapsedMs?: number;
  missingFields?: string[];
  checkedAt: string;
  recordsCount?: number;
  queryAttempts?: QueryAttempt[];
  winningQuery?: string;
};

type QueryAttempt = {
  query: string;
  elapsedMs: number;
  recordsCount: number;
  failureKind?: OpacSearchFailureKind;
  failureMessage?: string;
};

type ProbeResult = {
  ok: boolean;
  elapsedMs: number;
  reason: string;
  classification?: 'usable_records' | 'deterministic_no_records';
  recordsCount?: number;
  failureKind?: OpacSearchFailureKind;
  failureMessage?: string;
  queryAttempts: QueryAttempt[];
  winningQuery?: string;
};

const timeoutMs = Number(process.env.PROVIDER_TEST_TIMEOUT_MS ?? '12000');
const concurrency = Number(process.env.PROVIDER_TEST_CONCURRENCY ?? '4');
const defaultTestQueries = ['harry potter', 'potter', 'buch'];
const parseTestQueries = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((query) => query.trim())
    .filter((query) => query.length > 0);
const testQueries = parseTestQueries(process.env.PROVIDER_TEST_QUERIES ?? process.env.PROVIDER_TEST_QUERY);
if (testQueries.length === 0) {
  testQueries.push(...defaultTestQueries);
}
const testQuery = testQueries[0];
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

const probeUsableSearch = async (provider: OpacappNormalizedProvider): Promise<ProbeResult> => {
  const service = new SearchFlowService();
  const probeStarted = Date.now();
  const queryAttempts: QueryAttempt[] = [];
  let firstFailure: Pick<QueryAttempt, 'failureKind' | 'failureMessage'> | null = null;

  for (const query of testQueries) {
    const started = Date.now();
    try {
      const result = await withTimeout(
        service.search(provider, {
          query,
        }),
        timeoutMs,
      );
      const elapsedMs = Date.now() - started;
      const recordsCount = result.records.length;
      const failure = result.diagnostics?.failure;
      const attempt: QueryAttempt = {
        query,
        elapsedMs,
        recordsCount,
      };

      if (failure) {
        attempt.failureKind = failure.kind;
        attempt.failureMessage = failure.message;
        firstFailure ??= {
          failureKind: failure.kind,
          failureMessage: failure.message,
        };
      }

      queryAttempts.push(attempt);

      if (recordsCount > 0) {
        return {
          ok: true,
          elapsedMs: Date.now() - probeStarted,
          classification: 'usable_records',
          recordsCount,
          queryAttempts,
          winningQuery: query,
          reason: `Usable search returned ${recordsCount} records for query "${query}"`,
        };
      }
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : 'Unknown search error';
      const attempt: QueryAttempt = {
        query,
        elapsedMs: Date.now() - started,
        recordsCount: 0,
        failureMessage,
      };
      firstFailure ??= {
        failureMessage,
      };
      queryAttempts.push(attempt);
    }
  }

  const elapsedMs = Date.now() - probeStarted;
  if (!firstFailure) {
    return {
      ok: false,
      elapsedMs,
      classification: 'deterministic_no_records',
      recordsCount: 0,
      queryAttempts,
      reason: 'deterministic_no_records',
    };
  }

  const detail = firstFailure.failureMessage ? `: ${firstFailure.failureMessage}` : '';
  if (firstFailure.failureKind) {
    return {
      ok: false,
      elapsedMs,
      recordsCount: 0,
      failureKind: firstFailure.failureKind,
      failureMessage: firstFailure.failureMessage,
      queryAttempts,
      reason: `Search failure (${firstFailure.failureKind})${detail}`,
    };
  }

  return {
    ok: false,
    elapsedMs,
    recordsCount: 0,
    failureMessage: firstFailure.failureMessage,
    queryAttempts,
    reason: firstFailure.failureMessage ?? 'Unknown search error',
  };
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
      ? normalizeProviderBaseUrl(baseUrlValue, { api: provider.api, providerId: provider.id })
      : { normalizedUrl: null, reasons: [] as string[], rewritten: false };
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
        rewrittenBaseUrl: normalization.rewritten,
        rewriteFromHost: normalization.rewriteFromHost,
        rewriteToHost: normalization.rewriteToHost,
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
        rewrittenBaseUrl: normalization.rewritten,
        rewriteFromHost: normalization.rewriteFromHost,
        rewriteToHost: normalization.rewriteToHost,
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
        classification: probe.classification,
        reason: probe.reason,
        searchFailureKind: probe.failureKind,
        searchFailureMessage: probe.failureMessage,
        normalizationReasons: normalization.reasons,
        rewrittenBaseUrl: normalization.rewritten,
        rewriteFromHost: normalization.rewriteFromHost,
        rewriteToHost: normalization.rewriteToHost,
        elapsedMs: probe.elapsedMs,
        recordsCount: probe.recordsCount,
        queryAttempts: probe.queryAttempts,
        winningQuery: probe.winningQuery,
        checkedAt,
      } satisfies ProviderStatus;
    }

    return {
      id: provider.id ?? null,
      title: provider.title ?? null,
      api: provider.api ?? null,
      baseUrl: normalizedUrl,
      status: 'working',
      classification: probe.classification,
      normalizationReasons: normalization.reasons,
      rewrittenBaseUrl: normalization.rewritten,
      rewriteFromHost: normalization.rewriteFromHost,
      rewriteToHost: normalization.rewriteToHost,
      elapsedMs: probe.elapsedMs,
      recordsCount: probe.recordsCount,
      queryAttempts: probe.queryAttempts,
      winningQuery: probe.winningQuery,
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
  const classificationTotals = {
    usable_records: statuses.filter((status) => status.classification === 'usable_records').length,
    deterministic_no_records: statuses.filter((status) => status.classification === 'deterministic_no_records').length,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });

  const payload = {
    generatedAt,
    totals,
    classificationTotals,
    timeoutMs,
    concurrency,
    testQuery,
    testQueries,
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
