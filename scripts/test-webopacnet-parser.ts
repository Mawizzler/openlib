import { readFileSync } from 'node:fs';
import { parseWebOpacNetSearchResults } from '@/src/infrastructure/opac/parsers/webopacnet/parseWebOpacNetSearchResults';

const fixturePath = 'scripts/fixtures/webopacnet-search-sample.html';
const html = readFileSync(fixturePath, 'utf8');

const parsed = parseWebOpacNetSearchResults(html, 'https://example.webopac.net');

if (parsed.total !== 2) {
  throw new Error(`Expected total=2, got ${String(parsed.total)}`);
}

if (parsed.records.length !== 2) {
  throw new Error(`Expected 2 records, got ${parsed.records.length}`);
}

if (parsed.records[0]?.title !== 'The Pragmatic Programmer') {
  throw new Error(`Unexpected first title: ${parsed.records[0]?.title}`);
}

if (!parsed.records[1]?.authors?.[0]?.startsWith('Robert C. Martin')) {
  throw new Error(`Unexpected second author: ${parsed.records[1]?.authors?.[0]}`);
}

console.log('webopac.net parser fixture check passed');
