import { createLibrarySystemAdapter } from '@/src/infrastructure/opac/AdapterRegistry';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';

const query = process.argv[2] ?? 'harry potter';
const providerId = '8714';

const run = async () => {
  const provider = providersRegistryRepository.getProviderById(providerId);
  if (!provider) {
    console.error(`Provider ${providerId} not found.`);
    process.exit(1);
  }

  const adapter = createLibrarySystemAdapter(provider);
  const result = await adapter.search({ query, page: 1 });

  console.log(`Provider: ${provider.title} (${provider.id})`);
  console.log(`Base URL: ${provider.baseUrl}`);
  console.log(`Query: "${query}"`);
  console.log(`Total: ${result.total}`);
  console.log(`Records: ${result.records.length}`);

  const formatCounts = new Map<string, number>();
  result.records.forEach((record) => {
    const key = record.format ?? 'unknown';
    formatCounts.set(key, (formatCounts.get(key) ?? 0) + 1);
  });

  const sortedFormats = Array.from(formatCounts.entries()).sort((a, b) => b[1] - a[1]);
  console.log('\nFormat distribution:');
  sortedFormats.forEach(([format, count]) => {
    console.log(`- ${format}: ${count}`);
  });
};

run().catch((error) => {
  console.error('Leipzig SISIS check failed:', error);
  process.exit(1);
});
