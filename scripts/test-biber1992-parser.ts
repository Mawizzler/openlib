import { readFileSync } from 'node:fs';
import { parseBiber1992SearchResults } from '@/src/infrastructure/opac/parsers/biber1992/parseBiber1992SearchResults';

const fixturePath = 'scripts/fixtures/biber1992-search-sample.html';
const html = readFileSync(fixturePath, 'utf8');

const parsed = parseBiber1992SearchResults(html, 'https://catalog.example.org');

if (parsed.total !== 2) {
  throw new Error(`Expected total=2, got ${String(parsed.total)}`);
}

if (parsed.records.length !== 2) {
  throw new Error(`Expected 2 records, got ${parsed.records.length}`);
}

if (parsed.records[0]?.title !== 'Domain-Driven Design') {
  throw new Error(`Unexpected first title: ${parsed.records[0]?.title}`);
}

if (parsed.records[1]?.authors?.[0] !== 'Martin Fowler') {
  throw new Error(`Unexpected second author: ${parsed.records[1]?.authors?.[0]}`);
}

console.log('biber1992 parser fixture check passed');
