const API_ALIASES: Record<string, string> = {
  winbiap: 'bibliotheca',
  webopacnet: 'webopac.net',
};

const supportedApis = new Set([
  'sisis',
  'vufind',
  'bibliotheca',
  'open',
  'webopac.net',
  'pica',
  'littera',
  'biber1992',
  'primo',
  'adis',
  'koha',
  'iopac',
  'touchpoint',
]);

const normalizeProviderApi = (api: string | undefined): string | null => {
  if (typeof api !== 'string' || api.trim().length === 0) {
    return null;
  }

  const normalized = api.trim().toLowerCase();
  return API_ALIASES[normalized] ?? normalized;
};

const cases: Array<{ input: string | undefined; expected: string | null }> = [
  { input: 'winbiap', expected: 'bibliotheca' },
  { input: 'WINBIAP', expected: 'bibliotheca' },
  { input: ' winbiap ', expected: 'bibliotheca' },
  { input: 'webopacnet', expected: 'webopac.net' },
  { input: 'WEBOPACNET', expected: 'webopac.net' },
  { input: 'webopac.net', expected: 'webopac.net' },
  { input: ' open ', expected: 'open' },
  { input: undefined, expected: null },
  { input: '   ', expected: null },
];

for (const testCase of cases) {
  const actual = normalizeProviderApi(testCase.input);
  if (actual !== testCase.expected) {
    throw new Error(
      `normalizeProviderApi(${JSON.stringify(testCase.input)}) expected ${JSON.stringify(testCase.expected)} but got ${JSON.stringify(actual)}`,
    );
  }

  if (actual && !supportedApis.has(actual)) {
    throw new Error(`normalizeProviderApi(${JSON.stringify(testCase.input)}) returned unsupported API ${JSON.stringify(actual)}`);
  }
}

console.log(`Alias normalization checks passed: ${cases.length}`);
