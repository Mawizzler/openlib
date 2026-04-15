import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type ProviderEntry = {
  id?: string;
  title?: string;
  api?: string;
};

type ProvidersRegistry = {
  providers?: ProviderEntry[];
};

type ProviderProbe = {
  id: string | null;
  status: 'working' | 'partial' | 'failing';
  reason?: string;
};

type ProviderStatusArtifact = {
  generatedAt?: string;
  results?: ProviderProbe[];
};

type ProviderHealthStatus = 'green' | 'red' | 'unsupported';

type ProviderHealthRow = {
  providerId: string;
  status: ProviderHealthStatus;
  reason: string;
  checkedAt: string;
};

type ProviderHealthMatrix = {
  generatedAt: string;
  source: {
    registry: string;
    providerStatus: string;
  };
  totals: {
    providers: number;
    green: number;
    red: number;
    unsupported: number;
  };
  matrix: ProviderHealthRow[];
};

const REGISTRY_PATH = path.join(process.cwd(), 'data', 'providers.registry.json');
const STATUS_PATH = path.join(process.cwd(), 'artifacts', 'provider-status', 'status.json');
const OUTPUT_DIR = path.join(process.cwd(), 'artifacts', 'provider-health-matrix');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'matrix.json');

const supportedApis = new Set(['sisis', 'vufind']);

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
};

const toStatusReason = (probe: ProviderProbe): { status: Exclude<ProviderHealthStatus, 'unsupported'>; reason: string } => {
  if (probe.status === 'working') {
    return { status: 'green', reason: 'Provider endpoint reachable' };
  }
  return {
    status: 'red',
    reason: probe.reason?.trim() || (probe.status === 'partial' ? 'Provider endpoint partially reachable' : 'Provider endpoint unreachable'),
  };
};

const run = async () => {
  const generatedAt = new Date().toISOString();
  const registry = await readJson<ProvidersRegistry>(REGISTRY_PATH);
  const statusArtifact: ProviderStatusArtifact = await readJson<ProviderStatusArtifact>(STATUS_PATH).catch(
    () => ({ results: [] as ProviderProbe[] }),
  );

  const probeById = new Map<string, ProviderProbe>();
  for (const probe of statusArtifact.results ?? []) {
    if (typeof probe.id === 'string' && probe.id.trim().length > 0) {
      probeById.set(probe.id, probe);
    }
  }

  const matrix: ProviderHealthRow[] = (registry.providers ?? []).map((provider) => {
    const providerId = provider.id?.trim() || '';
    const api = provider.api?.toLowerCase().trim() || '';

    if (!supportedApis.has(api)) {
      return {
        providerId,
        status: 'unsupported',
        reason: api ? `Unsupported API: ${api}` : 'Unsupported API: unknown',
        checkedAt: generatedAt,
      };
    }

    const probe = probeById.get(providerId);
    if (!probe) {
      return {
        providerId,
        status: 'red',
        reason: 'No probe result available',
        checkedAt: generatedAt,
      };
    }

    const mapped = toStatusReason(probe);
    return {
      providerId,
      status: mapped.status,
      reason: mapped.reason,
      checkedAt: statusArtifact.generatedAt ?? generatedAt,
    };
  });

  const payload: ProviderHealthMatrix = {
    generatedAt,
    source: {
      registry: 'data/providers.registry.json',
      providerStatus: 'artifacts/provider-status/status.json',
    },
    totals: {
      providers: matrix.length,
      green: matrix.filter((entry) => entry.status === 'green').length,
      red: matrix.filter((entry) => entry.status === 'red').length,
      unsupported: matrix.filter((entry) => entry.status === 'unsupported').length,
    },
    matrix,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

  console.log(`Wrote ${OUTPUT_JSON}`);
  console.log(`Providers: ${payload.totals.providers}`);
  console.log(`Green: ${payload.totals.green}`);
  console.log(`Red: ${payload.totals.red}`);
  console.log(`Unsupported: ${payload.totals.unsupported}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
