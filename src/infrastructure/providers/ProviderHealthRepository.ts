export type ProviderHealthStatus = 'green' | 'red' | 'unsupported' | 'unknown';

type ProviderHealthArtifact = {
  matrix?: Array<{
    providerId?: string | null;
    status?: string | null;
    reason?: string | null;
    checkedAt?: string | null;
  }>;
};

const normalizeStatus = (value: string | null | undefined): ProviderHealthStatus => {
  if (value === 'green' || value === 'red' || value === 'unsupported') {
    return value;
  }
  return 'unknown';
};

const loadHealthMap = (): Map<string, ProviderHealthStatus> => {
  try {
    const artifact = require('../../../artifacts/provider-health-matrix/matrix.json') as ProviderHealthArtifact;
    const rows = Array.isArray(artifact.matrix) ? artifact.matrix : [];
    return new Map(
      rows
        .filter((row) => typeof row?.providerId === 'string' && row.providerId.trim().length > 0)
        .map((row) => [row.providerId!.trim(), normalizeStatus(row.status)]),
    );
  } catch {
    return new Map();
  }
};

const healthMap = loadHealthMap();

export const providerHealthRepository = {
  getStatus(providerId: string): ProviderHealthStatus {
    return healthMap.get(providerId) ?? 'unknown';
  },
};
