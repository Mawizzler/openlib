import type {
  LibrarySystemAdapter,
  LibrarySystemSearchInput,
  LibraryAccountLoginInput,
  LibraryAccountLoginResult,
  LibraryAccountSnapshotResult,
  LibraryAccountSession,
  LibraryAccountIdentity,
} from '@/src/application/ports/LibrarySystemAdapter';
import type {
  OpacAvailability,
  OpacRecord,
  OpacSearchDiagnostics,
  OpacSearchFailureKind,
  OpacSearchResult,
} from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { parseAdisSearchResults } from '@/src/infrastructure/opac/parsers/adis/parseAdisSearchResults';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TIMEOUT_MS = 8000;

type AdisSearchPayload = {
  total?: unknown;
  records?: unknown;
  result?: unknown;
  data?: unknown;
  items?: unknown;
  hits?: unknown;
};

type FetchCandidateResult = {
  url: string;
  payload: AdisSearchPayload;
};

const buildDiagnostics = (
  kind: OpacSearchFailureKind,
  message: string,
): OpacSearchDiagnostics => ({
  failure: { kind, message },
});

export class AdisAdapter implements LibrarySystemAdapter {
  readonly system = 'adis';
  private provider: OpacappNormalizedProvider;

  constructor(provider: OpacappNormalizedProvider) {
    this.provider = provider;
  }

  async search(input: LibrarySystemSearchInput): Promise<OpacSearchResult> {
    const page = input.page ?? 1;
    const query = input.query.trim();

    if (!query || !this.provider.baseUrl) {
      return { total: 0, page, pageSize: DEFAULT_PAGE_SIZE, records: [] };
    }

    try {
      const { url, payload } = await this.fetchSearchPayload(query, page);
      const parsed = parseAdisSearchResults(payload, this.normalizeBaseUrl());

      return {
        total: parsed.total,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        records: parsed.records,
        diagnostics:
          parsed.records.length > 0 || parsed.total > 0
            ? undefined
            : buildDiagnostics('parser', `ADIS search returned no parseable records from ${url}`),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ADIS search error.';
      console.warn('[AdisAdapter] search failed', error);
      return {
        total: 0,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        records: [],
        diagnostics: buildDiagnostics('transport', message),
      };
    }
  }

  async details(_input: { recordId: string; detailUrl?: string }): Promise<OpacRecord | null> {
    return null;
  }

  async availability(input: { recordId: string }): Promise<OpacAvailability> {
    return {
      recordId: input.recordId,
      availableCount: 0,
      totalCount: 0,
      holdsCount: 0,
    };
  }

  async accountLogin(input: LibraryAccountLoginInput): Promise<LibraryAccountLoginResult> {
    if (!input.username.trim() || !input.password.trim()) {
      return {
        status: 'invalid_credentials',
        message: 'Please enter both username and password.',
      };
    }

    return {
      status: 'success',
      identity: this.buildIdentity(input.username),
      session: this.buildSession(),
      message: 'Login scaffolding only. No live ADIS authentication yet.',
    };
  }

  async fetchAccountSnapshot(): Promise<LibraryAccountSnapshotResult> {
    return {
      status: 'success',
      snapshot: {
        loans: [],
        reservations: [],
      },
      message: 'Account snapshot scaffolding only. No live ADIS data yet.',
    };
  }

  private buildIdentity(username: string): LibraryAccountIdentity {
    return {
      providerId: this.provider.id,
      providerTitle: this.provider.title,
      username: username.trim(),
      displayName: username.trim(),
      authHint: this.provider.authHint,
    };
  }

  private buildSession(): LibraryAccountSession {
    const issuedAt = new Date().toISOString();
    return {
      id: `${this.system}-${this.provider.id}-${Date.now()}`,
      providerId: this.provider.id,
      issuedAt,
      expiresAt: issuedAt,
      token: 'adis-scaffold-session',
    };
  }

  private normalizeBaseUrl() {
    return (this.provider.baseUrl ?? '').trim().replace(/\/+$/, '');
  }

  private buildCandidateSearchUrls(query: string, page: number) {
    const baseUrl = this.normalizeBaseUrl();
    const params = [
      { q: query, page: String(page), limit: String(DEFAULT_PAGE_SIZE) },
      { query, page: String(page), limit: String(DEFAULT_PAGE_SIZE) },
      { lookfor: query, page: String(page), limit: String(DEFAULT_PAGE_SIZE) },
      { search: query, page: String(page), limit: String(DEFAULT_PAGE_SIZE) },
    ];
    const pathnames = ['/search.json', '/search', '/api/search', '/Search/Results'];

    return pathnames.flatMap((pathname) =>
      params.map((entry) => {
        const url = new URL(`${baseUrl}${pathname}`);
        Object.entries(entry).forEach(([key, value]) => url.searchParams.set(key, value));
        return url.toString();
      }),
    );
  }

  private async fetchSearchPayload(query: string, page: number): Promise<FetchCandidateResult> {
    const attempts: string[] = [];

    for (const url of this.buildCandidateSearchUrls(query, page)) {
      try {
        const payload = await this.fetchCandidate(url);
        return { url, payload };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push(`${url}: ${message}`);
      }
    }

    throw new Error(`ADIS search failed for all candidate endpoints. ${attempts.join(' | ')}`);
  }

  private async fetchCandidate(url: string): Promise<AdisSearchPayload> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'openlib-adis-adapter',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const body = await response.text();
      const payload = this.extractPayload(body);
      if (!payload) {
        throw new Error('response body did not contain an ADIS-like search payload');
      }

      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractPayload(body: string): AdisSearchPayload | null {
    const direct = this.parseJsonCandidate(body);
    if (direct) {
      return direct;
    }

    const applicationJsonScripts = body.match(
      /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
    );
    for (const block of applicationJsonScripts ?? []) {
      const scriptMatch = block.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
      const candidate = this.parseJsonCandidate(scriptMatch?.[1] ?? '');
      if (candidate) {
        return candidate;
      }
    }

    const inlineMatch = body.match(/\{[\s\S]*"(?:records|items|hits)"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/i);
    return inlineMatch ? this.parseJsonCandidate(inlineMatch[0]) : null;
  }

  private parseJsonCandidate(value: string): AdisSearchPayload | null {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return { records: parsed };
      }
      if (parsed && typeof parsed === 'object') {
        return parsed as AdisSearchPayload;
      }
    } catch {
      return null;
    }

    return null;
  }
}
