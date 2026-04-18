import fs from 'node:fs';
import path from 'node:path';
import { parseOpenMediensucheResults } from '@/src/infrastructure/opac/parsers/open/parseOpenMediensucheResults';

const fixturePath = path.resolve(__dirname, 'fixtures/open-mediensuche-sample.html');
const html = fs.readFileSync(fixturePath, 'utf8');

const parsed = parseOpenMediensucheResults(html, 'https://opac.example.org');

if (!parsed.records.length) {
  throw new Error('Expected fallback parser to extract at least one record.');
}

const first = parsed.records[0];
if (!first.title?.trim()) {
  throw new Error('Expected first record to include a non-empty title.');
}

if (!first.detailUrl?.startsWith('https://opac.example.org/')) {
  throw new Error('Expected first record to include an absolute detailUrl.');
}

console.log('open-mediensuche-parser-check:ok', {
  count: parsed.records.length,
  firstTitle: first.title,
  firstDetailUrl: first.detailUrl,
});
