import type { OpacappConfigSource, OpacappNormalizedProvider } from '@/src/domain/models/opacapp';

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

export const providersRegistryRepository = {
  listProviders(): OpacappNormalizedProvider[] {
    return providers;
  },
  getProviderById(id: string): OpacappNormalizedProvider | null {
    return providers.find((provider) => provider.id === id) ?? null;
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
