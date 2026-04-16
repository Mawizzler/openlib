import fs from 'node:fs';
import path from 'node:path';
import { parseBibliothecaSearchResults } from '@/src/infrastructure/opac/parsers/bibliotheca/parseBibliothecaSearchResults';

const fixturePath = path.join(process.cwd(), 'scripts', 'tests', 'fixtures', 'bibliotheca-search-sample.html');
const html = fs.readFileSync(fixturePath, 'utf8');

const parsed = parseBibliothecaSearchResults(html, 'https://bibliotheca.example');

if (parsed.records.length !== 3) {
  throw new Error(`Expected 3 records, got ${parsed.records.length}`);
}

if (parsed.total !== 3) {
  throw new Error(`Expected total 3, got ${String(parsed.total)}`);
}

if (parsed.records[0]?.title !== 'The Hobbit') {
  throw new Error(`Unexpected first title: ${parsed.records[0]?.title ?? 'missing'}`);
}

if (parsed.records[1]?.id !== '67890') {
  throw new Error(`Unexpected second id: ${parsed.records[1]?.id ?? 'missing'}`);
}

if (parsed.records[2]?.detailUrl !== 'https://bibliotheca.example/Mediensuche/EinfacheSuche?searchhash=abc&id=11111') {
  throw new Error(`Unexpected third detail URL: ${parsed.records[2]?.detailUrl ?? 'missing'}`);
}

console.log(`Bibliotheca parser check passed: ${parsed.records.length} records`);
