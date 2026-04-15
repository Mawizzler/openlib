import type { OpacappConfigSource, OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { providerHealthRepository } from '@/src/infrastructure/providers/ProviderHealthRepository';

export type ProvidersRegistryTotals = {
  files: number;
  providers: number;
  issues: number;
};

export type ProvidersRegistrySource = {
  repository: string;
  ref: string;
  path: string;
};

export type ProvidersRegistry = {
  generatedAt: string;
  source: ProvidersRegistrySource;
  totals: ProvidersRegistryTotals;
  providers: OpacappNormalizedProvider[];
  issues: unknown[];
};

const registry = require('../../../data/providers.registry.json') as ProvidersRegistry;

const providers = Array.isArray(registry.providers) ? registry.providers : [];

const withHealthStatus = (provider: OpacappNormalizedProvider): OpacappNormalizedProvider => ({
  ...provider,
  healthStatus: providerHealthRepository.getStatus(provider.id),
});

export const providersRegistryRepository = {
  listProviders(): OpacappNormalizedProvider[] {
    return providers.map(withHealthStatus);
  },
  getProviderById(id: string): OpacappNormalizedProvider | null {
    const provider = providers.find((entry) => entry.id === id);
    if (!provider) {
      return null;
    }
    return withHealthStatus(provider);
  },
  getSource(): OpacappConfigSource {
    return {
      repository: registry.source.repository,
      path: registry.source.path,
      file: registry.source.path,
      ref: registry.source.ref,
    };
  },
  getMetadata(): { generatedAt: string; totals: ProvidersRegistryTotals } {
    return {
      generatedAt: registry.generatedAt,
      totals: registry.totals,
    };
  },
};
