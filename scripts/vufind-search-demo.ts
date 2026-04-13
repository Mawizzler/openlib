import { SearchFlowService } from '@/src/application/services/opac/SearchFlowService';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';

const query = process.argv[2] ?? 'harry potter';
const providerId = process.argv[3];

const pickProvider = () => {
  if (providerId) {
    return providersRegistryRepository.getProviderById(providerId);
  }
  const providers = providersRegistryRepository.listProviders();
  return providers.find((provider) => provider.api.toLowerCase() === 'vufind') ?? null;
};

const run = async () => {
  const provider = pickProvider();
  if (!provider) {
    console.error('No VuFind provider found in registry.');
    process.exit(1);
  }

  const service = new SearchFlowService();
  const result = await service.search(provider, { query, page: 1 });

  console.log(`Provider: ${provider.title} (${provider.id})`);
  console.log(`Base URL: ${provider.baseUrl}`);
  console.log(`Query: "${query}"`);
  console.log(`Total: ${result.total}`);
  console.log(`Records: ${result.records.length}`);

  result.records.slice(0, 5).forEach((record, index) => {
    console.log(`${index + 1}. ${record.title}`);
    if (record.authors.length > 0) {
      console.log(`   Authors: ${record.authors.join('; ')}`);
    }
    console.log(`   ID: ${record.id}`);
  });
};

run().catch((error) => {
  console.error('VuFind demo failed:', error);
  process.exit(1);
});
