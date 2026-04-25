const LEIPZIG_CATALOG_HOST = 'bibliothekskatalog.leipzig.de';
const LEIPZIG_CATALOG_PATH_PATTERN = /^\/webOPACClient\/(?:start|search|hitList|singleHit)\.do$/;

export type CatalogProxyResolution = {
  url: string;
  init: RequestInit;
  proxied: boolean;
};

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

export const isLeipzigCatalogProxyTarget = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.toLowerCase() === LEIPZIG_CATALOG_HOST &&
      LEIPZIG_CATALOG_PATH_PATTERN.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

const cloneHeaders = (headers: HeadersInit | undefined): Headers => {
  try {
    return new Headers(headers);
  } catch {
    return new Headers();
  }
};

const proxyUrlFor = (url: string): string => `/api/catalog-proxy?url=${encodeURIComponent(url)}`;

export const resolveCatalogProxyRequest = (url: string, init: RequestInit = {}): CatalogProxyResolution => {
  if (!isBrowser() || !isLeipzigCatalogProxyTarget(url)) {
    return { url, init, proxied: false };
  }

  const headers = cloneHeaders(init.headers);
  const cookie = headers.get('Cookie');
  if (cookie) {
    headers.delete('Cookie');
    headers.set('X-OpenLib-Proxy-Cookie', cookie);
  }

  return {
    url: proxyUrlFor(url),
    init: {
      ...init,
      headers,
    },
    proxied: true,
  };
};
