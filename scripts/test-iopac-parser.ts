import { readFile } from 'node:fs/promises';
import { parseIopacSearchResults } from '@/src/infrastructure/opac/parsers/iopac/parseIopacSearchResults';

const run = async () => {
  const html = await readFile('scripts/fixtures/iopac-search-sample.html', 'utf-8');
  const parsed = parseIopacSearchResults(html, 'https://catalog.example.org');

  if (parsed.total !== 2) {
    throw new Error(`Expected total=2, got ${String(parsed.total)}`);
  }

  if (parsed.records.length !== 2) {
    throw new Error(`Expected 2 records, got ${parsed.records.length}`);
  }

  const first = parsed.records[0];
  if (first.id !== '98765') {
    throw new Error(`Expected first id=98765, got ${first.id}`);
  }
  if (first.title !== 'Practical Catalog Integration') {
    throw new Error(`Unexpected first title: ${first.title}`);
  }
  if (first.authors[0] !== 'Alex Parser') {
    throw new Error(`Expected first author Alex Parser, got ${first.authors[0]}`);
  }

  console.log('ok: iopac parser fixture assertions passed');
};

run().catch((error) => {
  console.error('iopac parser test failed', error);
  process.exitCode = 1;
});
