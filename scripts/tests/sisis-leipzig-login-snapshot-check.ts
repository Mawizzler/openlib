import { SisisAdapter } from '@/src/infrastructure/opac/adapters/SisisAdapter';

type MockResponseInit = {
  url: string;
  body: string;
  setCookie?: string;
};

class MockHeaders {
  private readonly values: Record<string, string>;

  constructor(values: Record<string, string>) {
    this.values = values;
  }

  get(name: string): string | null {
    return this.values[name.toLowerCase()] ?? null;
  }
}

class MockResponse {
  headers: MockHeaders;
  private readonly body: string;

  constructor(init: MockResponseInit) {
    this.headers = new MockHeaders({
      ...(init.setCookie ? { 'set-cookie': init.setCookie } : {}),
    });
    this.body = init.body;
  }

  async text() {
    return this.body;
  }
}

const makeProvider = () => ({
  id: 8714,
  title: 'Stadtbibliothek Leipzig',
  system: 'sisis',
  authHint: 'opac',
  baseUrl: 'https://webopac.stadtbibliothek-leipzig.de',
  accountSupported: true,
} as any);

const run = async () => {
  const adapter = new SisisAdapter(makeProvider());

  const originalFetch = global.fetch;
  const calls: string[] = [];
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    if (url.endsWith('/start.do')) {
      return new MockResponse({
        url,
        body: '<a href="/webOPACClient/userAccount.do">Konto</a>',
      }) as any;
    }

    if (url.includes('/userAccount.do') && url.includes('methodToCall=showLogin')) {
      return new MockResponse({
        url,
        body: '<html><body>login ok</body></html>',
        setCookie: 'JSESSIONID=abc123; Path=/; HttpOnly',
      }) as any;
    }

    if (url.includes('/userAccount.do') && !url.includes('methodToCall=showLogin')) {
      return new MockResponse({
        url,
        body: '<html><body>snapshot page</body></html>',
      }) as any;
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as any;

  try {
    const login = await adapter.accountLogin({ username: '1234', password: 'secret' });
    if (login.status !== 'success' || !login.session) {
      throw new Error(`Expected successful login, got ${JSON.stringify(login)}`);
    }

    const snapshot = await adapter.fetchAccountSnapshot({
      identity: login.identity!,
      session: login.session,
    });

    if (snapshot.status !== 'success') {
      throw new Error(`Expected successful snapshot, got ${JSON.stringify(snapshot)}`);
    }

    const firstCall = calls[0] ?? '';
    if (!firstCall.startsWith('https://bibliothekskatalog.leipzig.de/')) {
      throw new Error(`Expected Leipzig canonical host rewrite, got first URL ${firstCall}`);
    }

    const hasShowLogin = calls.some((entry) => entry.includes('methodToCall=showLogin'));
    if (!hasShowLogin) {
      throw new Error('Expected login flow to call methodToCall=showLogin endpoint');
    }

    console.log('SISIS Leipzig login/snapshot check passed.');
  } finally {
    global.fetch = originalFetch;
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
