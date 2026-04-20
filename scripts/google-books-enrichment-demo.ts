import { SearchFlowService } from '@/src/application/services/opac/SearchFlowService';
import { createLibrarySystemAdapter } from '@/src/infrastructure/opac/AdapterRegistry';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';

const query = process.argv[2] ?? 'feuerkelch buch';
const providerId = process.argv[3];

const pickProvider = () => {
  if (providerId) {
    return providersRegistryRepository.getProviderById(providerId);
  }

  const providers = providersRegistryRepository.listProviders();
  const leipzig = providers.find(
    (provider) => provider.location?.city === 'Leipzig' && provider.api.toLowerCase() === 'sisis',
  );
  if (leipzig) return leipzig;

  return providers.find((provider) => provider.location?.city === 'Leipzig') ?? null;
};

const pickIsbn = (identifiers?: { system: string; value: string }[]) => {
  if (!identifiers) return undefined;
  return identifiers.find((entry) => entry.system === 'isbn')?.value;
};

const run = async () => {
  const provider = pickProvider();
  if (!provider) {
    console.error('No Leipzig provider found in registry.');
    process.exit(1);
  }

  const adapter = createLibrarySystemAdapter(provider);
  const rawResult = await adapter.search({ query, page: 1 });
  const rawWithCover = rawResult.records.filter((record) => Boolean(record.coverUrl)).length;

  const service = new SearchFlowService();
  const enrichedResult = await service.search(provider, { query, page: 1 });
  const enrichedWithCover = enrichedResult.records.filter((record) => Boolean(record.coverUrl)).length;

  const rawById = new Map(rawResult.records.map((record) => [record.id, record]));
  const enrichedByIndex = enrichedResult.records.map((record, index) => ({
    record,
    raw: rawResult.records[index],
  }));
  let matchedBy = 'id';
  let newlyCovered = enrichedResult.records.filter((record) => {
    const raw = rawById.get(record.id);
    return raw && !raw.coverUrl && record.coverUrl;
  });

  if (newlyCovered.length === 0) {
    matchedBy = 'index';
    newlyCovered = enrichedByIndex
      .filter(({ raw, record }) => raw && !raw.coverUrl && record.coverUrl)
      .map(({ record }) => record);
  }

  console.log(`Provider: ${provider.title} (${provider.id})`);
  console.log(`Base URL: ${provider.baseUrl}`);
  console.log(`Query: "${query}"`);
  console.log(`Records: ${rawResult.records.length}`);
  console.log(`Cover URLs before enrichment: ${rawWithCover}`);
  console.log(`Cover URLs after enrichment: ${enrichedWithCover}`);
  console.log(`Newly covered records: ${newlyCovered.length}`);
  console.log(`Match strategy: ${matchedBy}`);

  newlyCovered.slice(0, 5).forEach((record, index) => {
    const isbn = pickIsbn(record.identifiers);
    console.log(`${index + 1}. ${record.title}`);
    console.log(`   ISBN: ${isbn ?? 'n/a'}`);
    console.log(`   Cover: ${record.coverUrl ?? 'n/a'}`);
  });
};

run().catch((error) => {
  console.error('Google Books enrichment demo failed:', error);
  process.exit(1);
});
