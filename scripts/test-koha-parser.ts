import { readFile } from 'node:fs/promises';
import { parseKohaSearchResults } from '@/src/infrastructure/opac/parsers/koha/parseKohaSearchResults';

const run = async () => {
  const html = await readFile('scripts/fixtures/koha-search-sample.html', 'utf-8');
  const parsed = parseKohaSearchResults(html, 'https://catalog.example.org');

  if (parsed.total !== 2) {
    throw new Error(`Expected total=2, got ${String(parsed.total)}`);
  }

  if (parsed.records.length !== 2) {
    throw new Error(`Expected 2 records, got ${parsed.records.length}`);
  }

  const first = parsed.records[0];
  if (first.id !== '12345') {
    throw new Error(`Expected first id=12345, got ${first.id}`);
  }
  if (first.title !== 'The Testing Book') {
    throw new Error(`Expected first title, got ${first.title}`);
  }
  if (first.authors[0] !== 'Jane Example') {
    throw new Error(`Expected first author Jane Example, got ${first.authors[0]}`);
  }

  console.log('ok: koha parser fixture assertions passed');
};

run().catch((error) => {
  console.error('koha parser test failed', error);
  process.exitCode = 1;
});
