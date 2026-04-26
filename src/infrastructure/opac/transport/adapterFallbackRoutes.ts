export type AdapterFallbackSystem = 'open' | 'webopac.net' | 'sisis' | 'primo' | 'adis' | 'koha';

export type AdapterFallbackRouteCandidate = {
  system: AdapterFallbackSystem;
  route: string;
  url: string;
};

export type AdapterFallbackRouteInput = {
  system: AdapterFallbackSystem;
  baseUrl: string;
  query: string;
  page: number;
  pageSize: number;
  providerId?: string | number;
};

export type AdapterFallbackRouteDiagnostics = {
  system: AdapterFallbackSystem;
  generatedCount: number;
  candidateCount: number;
  dedupedCount: number;
  routes: string[];
};

export type AdapterFallbackRoutes = {
  candidates: AdapterFallbackRouteCandidate[];
  diagnostics: AdapterFallbackRouteDiagnostics;
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/+$/, '');
const hasHttpScheme = (baseUrl: string) => /^http:\/\//i.test(baseUrl.trim());
const toHttpsBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/^http:\/\//i, 'https://');

type RouteQueryParams = Record<string, string> | ReadonlyArray<readonly [string, string]>;

const route = (
  system: AdapterFallbackSystem,
  routeName: string,
  baseUrl: string,
  pathname: string,
  params: RouteQueryParams,
): AdapterFallbackRouteCandidate => {
  const url = new URL(pathname, `${normalizeBaseUrl(baseUrl)}/`);
  if (Array.isArray(params)) {
    params.forEach(([key, value]) => url.searchParams.append(key, value));
  } else {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  return { system, route: routeName, url: url.toString() };
};

export const uniqueUrlCandidates = <T extends string | { url: string }>(candidates: T[]): T[] => {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const candidate of candidates) {
    const rawUrl = typeof candidate === 'string' ? candidate : candidate.url;
    const key = rawUrl.trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(candidate);
  }

  return unique;
};

export const isHttp404Error = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /\b(?:HTTP|status=)\s*404\b/i.test(error.message);
};

const openRoutes = (input: AdapterFallbackRouteInput): AdapterFallbackRouteCandidate[] => {
  const { baseUrl, query, page, pageSize, system } = input;
  return [
    route(system, 'open-search-json', baseUrl, '/search.json', {
      q: query,
      page: String(page),
      limit: String(pageSize),
    }),
    route(system, 'open-mediensuche-aspx', baseUrl, '/Mediensuche/EinfacheSuche.aspx', {
      search: query,
    }),
    route(system, 'open-mediensuche-slug', baseUrl, '/Mediensuche/Einfache-Suche', {
      search: query,
    }),
  ];
};

const webOpacNetRoutes = (input: AdapterFallbackRouteInput): AdapterFallbackRouteCandidate[] => {
  const { baseUrl, query, page, system } = input;
  return [
    route(system, 'webopacnet-stichwort', baseUrl, '/search.aspx', {
      STICHWORT: query,
      Seite: String(page),
    }),
    route(system, 'webopacnet-searchterm', baseUrl, '/search.aspx', {
      SEARCHTERM: query,
      Seite: String(page),
    }),
    route(system, 'webopacnet-akt-value', baseUrl, '/search.aspx', {
      AKT_VALUE: query,
      Seite: String(page),
    }),
  ];
};

const sisisRoutes = (input: AdapterFallbackRouteInput): AdapterFallbackRouteCandidate[] => {
  const { baseUrl, query, providerId, system } = input;
  const isLeipzig = String(providerId) === '8714';
  const searchPath = isLeipzig ? 'search.do' : '/search.do';
  const startPath = isLeipzig ? 'start.do' : '/start.do';
  const submitRoute = route(system, 'sisis-submit', baseUrl, searchPath, {
    methodToCall: 'submit',
    'searchCategories[0]': 'all',
    'searchString[0]': query,
  });
  const conQueryRoute = route(system, 'sisis-conquery', baseUrl, startPath, {
    sourceid: 'ConQuery',
    Login: 'stabi00',
    Query: `-1 = "${query}"`,
  });
  const quickSearchRoute = route(system, 'sisis-quick-search', baseUrl, searchPath, {
    methodToCall: 'quickSearch',
    Kateg: 'all',
    searchString: query,
  });

  return isLeipzig
    ? [conQueryRoute, submitRoute, quickSearchRoute]
    : [submitRoute, quickSearchRoute, conQueryRoute];
};

const primoRoutes = (input: AdapterFallbackRouteInput): AdapterFallbackRouteCandidate[] => {
  const { baseUrl, query, page, pageSize, system } = input;
  const start = String(Math.max(1, page - 1) * pageSize + 1);
  return [
    route(system, 'primo-action-search', baseUrl, '/primo_library/libweb/action/search.do', {
      fn: 'search',
      mode: 'Basic',
      vid: 'default',
      tab: 'default_tab',
      dum: 'true',
      indx: start,
      bulkSize: String(pageSize),
      'vl(freeText0)': query,
    }),
    route(system, 'primo-action-search-scope', baseUrl, '/primo_library/libweb/action/search.do', {
      fn: 'search',
      mode: 'Basic',
      vid: 'default',
      tab: 'default_tab',
      search_scope: 'default_scope',
      dum: 'true',
      indx: start,
      bulkSize: String(pageSize),
      'vl(freeText0)': query,
    }),
  ];
};

const adisRoutes = (input: AdapterFallbackRouteInput): AdapterFallbackRouteCandidate[] => {
  const { baseUrl, query, page, pageSize, providerId, system } = input;
  if (String(providerId) === '9023') {
    const directParams: Array<{
      routeName: string;
      params: ReadonlyArray<readonly [string, string]>;
    }> = [
      {
        routeName: 'adis-9023-direct-home-searchform-freitext-sopac00-combined',
        params: [
          ['service', 'direct/0/Home/$SearchForm'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKFreitext S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-searchform-stichwort-sopac00-combined',
        params: [
          ['service', 'direct/0/Home/$SearchForm'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKSW S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-directlink-freitext-sopac00-combined',
        params: [
          ['service', 'direct/0/Home/$DirectLink'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKFreitext S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-directlink-stichwort-sopac00-combined',
        params: [
          ['service', 'direct/0/Home/$DirectLink'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKSW S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-searchform-freitext-sopac00-combined-xslt10',
        params: [
          ['service', 'direct/0/Home/$SearchForm'],
          ['searchMask', ''],
          ['XSLT_DB', '10'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKFreitext S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-searchform-stichwort-sopac00-combined-xslt10',
        params: [
          ['service', 'direct/0/Home/$SearchForm'],
          ['searchMask', ''],
          ['XSLT_DB', '10'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKSW S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-directlink-freitext-sopac00-combined-xslt10',
        params: [
          ['service', 'direct/0/Home/$DirectLink'],
          ['searchMask', ''],
          ['XSLT_DB', '10'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKFreitext S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-directlink-stichwort-sopac00-combined-xslt10',
        params: [
          ['service', 'direct/0/Home/$DirectLink'],
          ['searchMask', ''],
          ['XSLT_DB', '10'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKSW S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-searchform-freitext-sopac00-combined-xslt1',
        params: [
          ['service', 'direct/0/Home/$SearchForm'],
          ['searchMask', ''],
          ['XSLT_DB', '1'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKFreitext S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-searchform-stichwort-sopac00-combined-xslt1',
        params: [
          ['service', 'direct/0/Home/$SearchForm'],
          ['searchMask', ''],
          ['XSLT_DB', '1'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKSW S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-directlink-freitext-sopac00-combined-xslt1',
        params: [
          ['service', 'direct/0/Home/$DirectLink'],
          ['searchMask', ''],
          ['XSLT_DB', '1'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKFreitext S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-directlink-stichwort-sopac00-combined-xslt1',
        params: [
          ['service', 'direct/0/Home/$DirectLink'],
          ['searchMask', ''],
          ['XSLT_DB', '1'],
          ['sp', 'SOPAC00'],
          ['sp', `SAKSW S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-searchform-freitext',
        params: [
          ['service', 'direct/0/Home/$SearchForm'],
          ['searchMask', ''],
          ['XSLT_DB', '10'],
          ['sp', 'SBF'],
          ['sp', 'SAKFreitext'],
          ['sp', `S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-searchform-stichwort',
        params: [
          ['service', 'direct/0/Home/$SearchForm'],
          ['searchMask', ''],
          ['XSLT_DB', '10'],
          ['sp', 'SBF'],
          ['sp', 'SAKSW'],
          ['sp', `S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-directlink-freitext',
        params: [
          ['service', 'direct/0/Home/$DirectLink'],
          ['searchMask', ''],
          ['XSLT_DB', '10'],
          ['sp', 'SBF'],
          ['sp', 'SAKFreitext'],
          ['sp', `S${query}`],
        ],
      },
      {
        routeName: 'adis-9023-direct-home-directlink-stichwort',
        params: [
          ['service', 'direct/0/Home/$DirectLink'],
          ['searchMask', ''],
          ['XSLT_DB', '10'],
          ['sp', 'SBF'],
          ['sp', 'SAKSW'],
          ['sp', `S${query}`],
        ],
      },
    ];

    return directParams.map((entry) => route(system, entry.routeName, baseUrl, '.', entry.params));
  }

  const params: Record<string, string>[] = [
    { q: query, page: String(page), limit: String(pageSize) },
    { query, page: String(page), limit: String(pageSize) },
    { lookfor: query, page: String(page), limit: String(pageSize) },
    { search: query, page: String(page), limit: String(pageSize) },
  ];
  const pathnames = ['/search.json', '/search', '/api/search', '/Search/Results'];

  return pathnames.flatMap((pathname) =>
    params.map((entry, index) =>
      route(
        system,
        `adis-${pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-${index + 1}`,
        baseUrl,
        pathname,
        entry,
      ),
    ),
  );
};

const kohaRoutes = (input: AdapterFallbackRouteInput): AdapterFallbackRouteCandidate[] => {
  const { baseUrl, query, page, pageSize, system } = input;
  const offset = String(Math.max(0, page - 1) * pageSize);
  return [
    route(system, 'koha-opac-search-kw', baseUrl, '/cgi-bin/koha/opac-search.pl', {
      q: query,
      idx: 'kw',
      count: String(pageSize),
      offset,
      sort_by: 'relevance',
    }),
    route(system, 'koha-opac-search-default', baseUrl, '/cgi-bin/koha/opac-search.pl', {
      q: query,
      count: String(pageSize),
      offset,
    }),
    route(system, 'koha-opac-search-keyword', baseUrl, '/cgi-bin/koha/opac-search.pl', {
      keyword: query,
      count: String(pageSize),
      offset,
    }),
  ];
};

const withPromotedHttpsCandidates = (
  input: AdapterFallbackRouteInput,
  buildRoutes: (nextInput: AdapterFallbackRouteInput) => AdapterFallbackRouteCandidate[],
): AdapterFallbackRouteCandidate[] => {
  if (!hasHttpScheme(input.baseUrl)) {
    return buildRoutes(input);
  }

  return [
    ...buildRoutes({ ...input, baseUrl: toHttpsBaseUrl(input.baseUrl) }),
    ...buildRoutes(input),
  ];
};

export const buildAdapterFallbackRoutes = (input: AdapterFallbackRouteInput): AdapterFallbackRoutes => {
  let generated: AdapterFallbackRouteCandidate[];

  switch (input.system) {
    case 'open':
      generated = withPromotedHttpsCandidates(input, openRoutes);
      break;
    case 'webopac.net':
      generated = withPromotedHttpsCandidates(input, webOpacNetRoutes);
      break;
    case 'sisis':
      generated = sisisRoutes(input);
      break;
    case 'primo':
      generated = withPromotedHttpsCandidates(input, primoRoutes);
      break;
    case 'adis':
      generated = adisRoutes(input);
      break;
    case 'koha':
      generated = kohaRoutes(input);
      break;
  }

  const candidates = uniqueUrlCandidates(generated);

  return {
    candidates,
    diagnostics: {
      system: input.system,
      generatedCount: generated.length,
      candidateCount: candidates.length,
      dedupedCount: generated.length - candidates.length,
      routes: candidates.map((candidate) => candidate.route),
    },
  };
};
