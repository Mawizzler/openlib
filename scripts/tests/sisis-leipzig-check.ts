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

  const firstRecord = result.records.find((record) => Boolean(record.detailUrl));
  if (!firstRecord) {
    console.error('No detail record found in search results.');
    process.exit(1);
  }

  const searchIsbns = firstRecord.identifiers
    ?.filter((identifier) => identifier.system === 'isbn')
    .map((identifier) => identifier.value);

  console.log('\nSearch sample:');
  console.log(`Title: ${firstRecord.title}`);
  console.log(`Record ID: ${firstRecord.id}`);
  console.log(`Availability: ${firstRecord.availabilityStatus ?? 'n/a'} | ${firstRecord.availabilityLabel ?? 'n/a'}`);
  console.log(`ISBNs: ${searchIsbns && searchIsbns.length > 0 ? searchIsbns.join(', ') : 'n/a'}`);

  if (!firstRecord.detailUrl) {
    console.error('Missing detail URL for sample record.');
    process.exit(1);
  }

  const detail = await adapter.details({ recordId: firstRecord.id, detailUrl: firstRecord.detailUrl });
  if (!detail) {
    console.error('No detail record returned.');
    process.exit(1);
  }

  const detailIsbns = detail.identifiers
    ?.filter((identifier) => identifier.system === 'isbn')
    .map((identifier) => identifier.value);

  console.log('\nDetail sample:');
  console.log(`Title: ${detail.title}`);
  console.log(`Availability: ${detail.availabilityStatus ?? 'n/a'} | ${detail.availabilityLabel ?? 'n/a'}`);
  console.log(`ISBNs: ${detailIsbns && detailIsbns.length > 0 ? detailIsbns.join(', ') : 'n/a'}`);
};

run().catch((error) => {
  console.error('Leipzig SISIS check failed:', error);
  process.exit(1);
});
