import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REGISTRY_PATH = path.join(process.cwd(), 'data', 'providers.registry.json');
const OUTPUT_DIR = path.join(process.cwd(), 'artifacts', 'provider-status');
const STATUS_JSON_PATH = path.join(OUTPUT_DIR, 'status.json');
const STATUS_MD_PATH = path.join(OUTPUT_DIR, 'status.md');

const REQUIRED_FIELDS = ['id', 'title', 'api', 'baseUrl'] as const;

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
  httpStatus?: number;
  elapsedMs?: number;
  missingFields?: string[];
};

const timeoutMs = Number(process.env.PROVIDER_TEST_TIMEOUT_MS ?? '4500');
const concurrency = Number(process.env.PROVIDER_TEST_CONCURRENCY ?? '6');

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const validateProvider = (provider: ProviderEntry) => {
  const missing = REQUIRED_FIELDS.filter((key) => !isNonEmptyString(provider[key]));
  return {
    ok: missing.length === 0,
    missing,
  };
};

const normalizeUrl = (baseUrl: string): string | null => {
  try {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number) => {
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), timeout);
  const started = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
    const elapsedMs = Date.now() - started;
    return { response, elapsedMs };
  } finally {
    clearTimeout(handle);
  }
};

const probeUrl = async (url: string) => {
  try {
    const headResult = await fetchWithTimeout(url, { method: 'HEAD' }, timeoutMs);
    if (headResult.response.status === 405 || headResult.response.status === 501) {
      const getResult = await fetchWithTimeout(url, { method: 'GET' }, timeoutMs);
      return {
        ok: getResult.response.status < 400,
        status: getResult.response.status,
        elapsedMs: getResult.elapsedMs,
      };
    }

    return {
      ok: headResult.response.status < 400,
      status: headResult.response.status,
      elapsedMs: headResult.elapsedMs,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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

  const statuses = await mapLimit(providers, concurrency, async (provider) => {
    const validation = validateProvider(provider);
    const baseUrlValue = isNonEmptyString(provider.baseUrl) ? provider.baseUrl : null;
    const normalizedUrl = baseUrlValue ? normalizeUrl(baseUrlValue) : null;

    if (!validation.ok) {
      return {
        id: isNonEmptyString(provider.id) ? provider.id : null,
        title: isNonEmptyString(provider.title) ? provider.title : null,
        api: isNonEmptyString(provider.api) ? provider.api : null,
        baseUrl: baseUrlValue,
        status: 'failing',
        reason: 'Missing required fields',
        missingFields: validation.missing,
      } satisfies ProviderStatus;
    }

    if (!normalizedUrl) {
      return {
        id: provider.id ?? null,
        title: provider.title ?? null,
        api: provider.api ?? null,
        baseUrl: baseUrlValue,
        status: 'failing',
        reason: 'Invalid base URL',
      } satisfies ProviderStatus;
    }

    const probe = await probeUrl(normalizedUrl);

    if (!probe.ok) {
      if (probe.status) {
        return {
          id: provider.id ?? null,
          title: provider.title ?? null,
          api: provider.api ?? null,
          baseUrl: normalizedUrl,
          status: 'partial',
          reason: `HTTP ${probe.status}`,
          httpStatus: probe.status,
          elapsedMs: probe.elapsedMs,
        } satisfies ProviderStatus;
      }

      return {
        id: provider.id ?? null,
        title: provider.title ?? null,
        api: provider.api ?? null,
        baseUrl: normalizedUrl,
        status: 'failing',
        reason: probe.error ?? 'Unreachable',
      } satisfies ProviderStatus;
    }

    return {
      id: provider.id ?? null,
      title: provider.title ?? null,
      api: provider.api ?? null,
      baseUrl: normalizedUrl,
      status: 'working',
      httpStatus: probe.status,
      elapsedMs: probe.elapsedMs,
    } satisfies ProviderStatus;
  });

  const totals = {
    providers: statuses.length,
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
