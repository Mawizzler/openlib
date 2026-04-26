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
import {
  buildAdapterFallbackRoutes,
  isHttp404Error,
} from '@/src/infrastructure/opac/transport/adapterFallbackRoutes';
import { fetchTextWithRetry } from '@/src/infrastructure/opac/transport/fetchWithRetry';
import { normalizeProviderBaseUrl } from '@/src/infrastructure/opac/transport/normalizeProviderBaseUrl';

const DEFAULT_PAGE_SIZE = 20;

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

type Adis9023SessionState = {
  cookie?: string;
};

type Adis9023Bootstrap = {
  actionUrl: string;
  hiddenFields: Array<readonly [string, string]>;
};

type Adis9023BootstrapHandoff = {
  metaRefreshUrl: string | null;
  directAnchorUrl: string | null;
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
    return this.resolveNormalizedProviderBaseUrl().replace(/\/+$/, '');
  }

  private resolveNormalizedProviderBaseUrl() {
    const candidate = (this.provider.baseUrl ?? '').trim();
    return (
      normalizeProviderBaseUrl(candidate, { api: this.system, providerId: this.provider.id }).normalizedUrl ??
      candidate
    );
  }

  private async fetchSearchPayload(query: string, page: number): Promise<FetchCandidateResult> {
    const attempts: string[] = [];
    const exhausted404Families = new Set<string>();
    const baseUrl = this.normalizeBaseUrl();
    const { candidates } = buildAdapterFallbackRoutes({
      system: this.system,
      baseUrl,
      query,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      providerId: this.provider.id,
    });

    if (String(this.provider.id) === '9023') {
      return this.fetch9023SessionBoundSearchPayload(candidates);
    }

    for (const candidate of candidates) {
      const family = this.pathnameFamily(candidate.url);
      if (family && exhausted404Families.has(family)) {
        continue;
      }

      try {
        const payload = await this.fetchCandidate(candidate.url);
        return { url: candidate.url, payload };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push(`${candidate.url}: ${message}`);
        if (!isHttp404Error(error)) {
          throw error;
        }
        if (family) {
          exhausted404Families.add(family);
        }
      }
    }

    throw new Error(`ADIS search failed for all candidate endpoints. ${attempts.join(' | ')}`);
  }

  private async fetch9023SessionBoundSearchPayload(candidates: { url: string }[]): Promise<FetchCandidateResult> {
    const attempts: string[] = [];
    const exhausted404Families = new Set<string>();
    const session: Adis9023SessionState = {};
    const bootstrap = await this.bootstrap9023SearchSession(session);

    for (const candidate of candidates) {
      const family = this.pathnameFamily(candidate.url);
      if (family && exhausted404Families.has(family)) {
        continue;
      }

      try {
        const payload = await this.fetch9023Candidate(bootstrap, session, candidate.url);
        return { url: candidate.url, payload };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push(`${candidate.url}: ${message}`);
        if (!isHttp404Error(error)) {
          continue;
        }
        if (family) {
          exhausted404Families.add(family);
        }
      }
    }

    throw new Error(`ADIS search failed for all candidate endpoints. ${attempts.join(' | ')}`);
  }

  private pathnameFamily(url: string): string | null {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.replace(/\/+$/, '').toLowerCase();
      if (String(this.provider.id) !== '9023') {
        return pathname;
      }

      const service = parsed.searchParams.get('service') ?? '';
      const searchMask = parsed.searchParams.get('searchMask') ?? '';
      const xsltDb = parsed.searchParams.get('XSLT_DB') ?? '';
      const sp = parsed.searchParams.getAll('sp').join('|');
      return `${pathname}?service=${service}&searchMask=${searchMask}&XSLT_DB=${xsltDb}&sp=${sp}`;
    } catch {
      return null;
    }
  }

  private async fetchCandidate(url: string): Promise<AdisSearchPayload> {
    const body = await fetchTextWithRetry(url, {
      headers: {
        Accept: 'application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'openlib-adis-adapter',
      },
    });
    const payload = this.extractPayload(body);
    if (!payload) {
      throw new Error('response body did not contain an ADIS-like search payload');
    }

    return payload;
  }

  private async bootstrap9023SearchSession(session: Adis9023SessionState): Promise<Adis9023Bootstrap> {
    let currentUrl = this.resolveNormalizedProviderBaseUrl();
    const maxHops = 2;
    for (let hop = 0; hop <= maxHops; hop += 1) {
      const body = await fetchTextWithRetry(
        currentUrl,
        {
          headers: this.buildAdisRequestHeaders(session),
        },
        {
          onResponse: (response) => this.captureCookies(response, session),
        },
      );

      const parsed = this.parse9023FormBootstrap(body, currentUrl);
      if (parsed) {
        return parsed;
      }

      if (hop >= maxHops) {
        break;
      }

      const handoff = this.parse9023BootstrapHandoff(body, currentUrl);
      const nextUrl = handoff.metaRefreshUrl ?? handoff.directAnchorUrl;
      if (!nextUrl) {
        break;
      }
      currentUrl = nextUrl;
    }

    throw new Error('ADIS 9023 bootstrap did not contain a usable direct/1 *.form action');
  }

  private parse9023FormBootstrap(html: string, bootstrapUrl: string): Adis9023Bootstrap | null {
    const formPattern = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
    let formMatch: RegExpExecArray | null = null;
    while ((formMatch = formPattern.exec(html)) !== null) {
      const openTagAttrs = formMatch[1] ?? '';
      const actionRaw = this.readHtmlAttribute(openTagAttrs, 'action');
      if (!actionRaw) {
        continue;
      }

      const action = this.decodeHtmlEntities(actionRaw);
      const lowerAction = action.toLowerCase();
      if (!lowerAction.includes('service=direct/1/') || !lowerAction.includes('.form')) {
        continue;
      }

      const actionUrl = new URL(action, bootstrapUrl).toString();
      const hiddenFields = this.extractHiddenFields(formMatch[2] ?? '');
      return { actionUrl, hiddenFields };
    }

    return null;
  }

  private parse9023BootstrapHandoff(html: string, pageUrl: string): Adis9023BootstrapHandoff {
    const metaRefreshUrl = this.extractMetaRefreshUrl(html, pageUrl);
    const directAnchorUrl = this.extractDirect0AnchorUrl(html, pageUrl);
    return { metaRefreshUrl, directAnchorUrl };
  }

  private extractMetaRefreshUrl(html: string, pageUrl: string): string | null {
    const metaPattern = /<meta\b([^>]*)>/gi;
    let metaMatch: RegExpExecArray | null = null;
    while ((metaMatch = metaPattern.exec(html)) !== null) {
      const attrs = metaMatch[1] ?? '';
      const httpEquiv = (this.readHtmlAttribute(attrs, 'http-equiv') ?? '').trim().toLowerCase();
      if (httpEquiv !== 'refresh') {
        continue;
      }

      const content = this.decodeHtmlEntities(this.readHtmlAttribute(attrs, 'content') ?? '');
      const refreshMatch = content.match(/(?:^|;)\s*url\s*=\s*(['"]?)([^'";]+)\1/i);
      const refreshTarget = refreshMatch?.[2]?.trim();
      if (!refreshTarget) {
        continue;
      }

      try {
        return new URL(refreshTarget, pageUrl).toString();
      } catch {
        continue;
      }
    }

    return null;
  }

  private extractDirect0AnchorUrl(html: string, pageUrl: string): string | null {
    const anchorPattern = /<a\b([^>]*)>/gi;
    let anchorMatch: RegExpExecArray | null = null;
    while ((anchorMatch = anchorPattern.exec(html)) !== null) {
      const attrs = anchorMatch[1] ?? '';
      const hrefRaw = this.readHtmlAttribute(attrs, 'href');
      if (!hrefRaw) {
        continue;
      }

      const href = this.decodeHtmlEntities(hrefRaw);
      if (!href.toLowerCase().includes('service=direct/0/')) {
        continue;
      }

      try {
        return new URL(href, pageUrl).toString();
      } catch {
        continue;
      }
    }

    return null;
  }

  private extractHiddenFields(html: string): Array<readonly [string, string]> {
    const fields: Array<readonly [string, string]> = [];
    const inputPattern = /<input\b([^>]*)>/gi;
    let inputMatch: RegExpExecArray | null = null;
    while ((inputMatch = inputPattern.exec(html)) !== null) {
      const attrs = inputMatch[1] ?? '';
      const type = (this.readHtmlAttribute(attrs, 'type') ?? '').trim().toLowerCase();
      if (type !== 'hidden') {
        continue;
      }

      const name = this.readHtmlAttribute(attrs, 'name');
      if (!name) {
        continue;
      }

      const value = this.readHtmlAttribute(attrs, 'value') ?? '';
      fields.push([this.decodeHtmlEntities(name), this.decodeHtmlEntities(value)]);
    }

    return fields;
  }

  private readHtmlAttribute(attrs: string, attribute: string): string | null {
    const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\\`]+))`,
      'i',
    );
    const match = attrs.match(pattern);
    return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  private async fetch9023Candidate(
    bootstrap: Adis9023Bootstrap,
    session: Adis9023SessionState,
    candidateUrl: string,
  ): Promise<AdisSearchPayload> {
    const body = await fetchTextWithRetry(
      bootstrap.actionUrl,
      {
        method: 'POST',
        headers: {
          ...this.buildAdisRequestHeaders(session),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: this.build9023PostBody(bootstrap.hiddenFields, candidateUrl),
      },
      {
        onResponse: (response) => this.captureCookies(response, session),
      },
    );
    const payload = this.extractPayload(body);
    if (!payload) {
      throw new Error('response body did not contain an ADIS-like search payload');
    }

    return payload;
  }

  private buildAdisRequestHeaders(session: Adis9023SessionState): Record<string, string> {
    return {
      Accept: 'application/json,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'openlib-adis-adapter',
      ...(session.cookie ? { Cookie: session.cookie } : {}),
    };
  }

  private build9023PostBody(
    hiddenFields: Array<readonly [string, string]>,
    candidateUrl: string,
  ): URLSearchParams {
    const params = new URLSearchParams();
    hiddenFields.forEach(([key, value]) => params.append(key, value));

    const candidate = new URL(candidateUrl);
    if (candidate.searchParams.has('service')) {
      params.set('service', candidate.searchParams.get('service') ?? '');
    }
    if (candidate.searchParams.has('searchMask')) {
      params.set('searchMask', candidate.searchParams.get('searchMask') ?? '');
    }
    if (candidate.searchParams.has('XSLT_DB')) {
      params.set('XSLT_DB', candidate.searchParams.get('XSLT_DB') ?? '');
    }
    candidate.searchParams.getAll('sp').forEach((value) => params.append('sp', value));

    return params;
  }

  private captureCookies(response: Response, session: Adis9023SessionState) {
    try {
      const headerValues = [
        response.headers.get('set-cookie'),
        response.headers.get('x-openlib-proxy-set-cookie'),
      ].filter((value): value is string => Boolean(value));
      if (headerValues.length === 0) {
        return;
      }

      const incomingCookies = headerValues.flatMap((value) => this.extractCookiePairs(value));
      if (incomingCookies.length === 0) {
        return;
      }

      session.cookie = this.mergeCookies(session.cookie, incomingCookies);
    } catch {
      // Ignore cookie parsing failures and continue probing fallbacks.
    }
  }

  private extractCookiePairs(setCookieHeader: string): string[] {
    const pairs: string[] = [];
    const pattern = /(?:^|,)\s*([^=;,\s]+)=([^;,\r\n]*)/g;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(setCookieHeader)) !== null) {
      pairs.push(`${match[1]}=${match[2]}`);
    }
    return pairs;
  }

  private mergeCookies(currentCookieHeader: string | undefined, incomingPairs: string[]): string {
    const merged = new Map<string, string>();

    if (currentCookieHeader) {
      currentCookieHeader
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          const separatorIndex = part.indexOf('=');
          if (separatorIndex <= 0) return;
          const key = part.slice(0, separatorIndex).trim();
          const value = part.slice(separatorIndex + 1).trim();
          if (key && value) {
            merged.set(key, value);
          }
        });
    }

    incomingPairs.forEach((pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) return;
      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (key && value) {
        merged.set(key, value);
      }
    });

    return Array.from(merged.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
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
