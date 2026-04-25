export type ProviderUrlNormalizationOptions = {
  api?: string;
  providerId?: string;
};

export type ProviderUrlNormalizationResult = {
  normalizedUrl: string | null;
  reasons: string[];
  rewritten: boolean;
  rewriteFromHost?: string;
  rewriteToHost?: string;
};

const QUOTE_TRIM_PATTERN = /^["'`\s]+|["'`\s]+$/g;

const API_PATH_STRIP_PATTERNS: Record<string, RegExp[]> = {
  sisis: [/^\/(?:start|search|hitList|singleHit)\.do$/i],
  primo: [/^\/primo_library\/libweb(?:\/.*)?$/i],
  koha: [/^\/cgi-bin\/koha(?:\/.*)?$/i],
  'webopac.net': [/^\/search\.aspx$/i],
  open: [/^\/search\.json$/i, /^\/Mediensuche(?:\/.*)?$/i],
  adis: [/^\/search\.json$/i, /^\/search$/i, /^\/api\/search$/i, /^\/Search\/Results$/i],
};

const API_ALIASES: Record<string, string> = {
  webopacnet: 'webopac.net',
  winbiap: 'bibliotheca',
};

const stripOuterQuotesAndWhitespace = (value: string): string => value.replace(QUOTE_TRIM_PATTERN, '');

const removeDuplicateSchemePrefix = (value: string): { cleaned: string; changed: boolean } => {
  const pattern = /^(https?:\/\/)(https?:\/\/)+/i;
  const match = value.match(pattern);
  if (!match) {
    return { cleaned: value, changed: false };
  }

  const remainder = value.slice(match[0].length);
  return {
    cleaned: `${match[1]}${remainder}`,
    changed: true,
  };
};

const normalizeApi = (api: string | undefined): string | null => {
  const normalized = api?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return API_ALIASES[normalized] ?? normalized;
};

const stripApiPath = (url: URL, api: string | null, reasons: string[]) => {
  if (!api) {
    return;
  }

  const patterns = API_PATH_STRIP_PATTERNS[api];
  if (!patterns?.some((pattern) => pattern.test(url.pathname))) {
    return;
  }

  url.pathname = '/';
  url.search = '';
  url.hash = '';
  reasons.push(`stripped ${api} API endpoint path from base URL`);
};

export const normalizeProviderBaseUrl = (
  rawBaseUrl: string,
  options: ProviderUrlNormalizationOptions = {},
): ProviderUrlNormalizationResult => {
  const reasons: string[] = [];

  const trimmed = stripOuterQuotesAndWhitespace(rawBaseUrl);
  if (trimmed !== rawBaseUrl) {
    reasons.push('trimmed surrounding whitespace/quotes');
  }

  const { cleaned, changed } = removeDuplicateSchemePrefix(trimmed);
  if (changed) {
    reasons.push('repaired duplicate URL scheme prefix');
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    reasons.push('invalid URL syntax');
    return { normalizedUrl: null, reasons, rewritten: false };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    reasons.push(`unsupported URL scheme: ${parsed.protocol}`);
    return { normalizedUrl: null, reasons, rewritten: false };
  }

  let rewritten = false;
  let rewriteFromHost: string | undefined;
  let rewriteToHost: string | undefined;

  const host = parsed.hostname.toLowerCase();
  if (host === 'bibliotheken.kivbf.de') {
    rewriteFromHost = parsed.hostname;
    parsed.hostname = 'bibliotheken.komm.one';
    rewriteToHost = parsed.hostname;
    rewritten = true;
    reasons.push('rewrote deterministic redirect-family host: bibliotheken.kivbf.de -> bibliotheken.komm.one');
  } else if (host === 'webopac.stadtbibliothek-leipzig.de') {
    rewriteFromHost = parsed.hostname;
    parsed.hostname = 'bibliothekskatalog.leipzig.de';
    rewriteToHost = parsed.hostname;
    rewritten = true;
    reasons.push(
      'rewrote deterministic redirect-family host: webopac.stadtbibliothek-leipzig.de -> bibliothekskatalog.leipzig.de',
    );
  } else if (host === 'bibliothek.komm.one') {
    reasons.push('kept canonical bibliothek.komm.one host');
  } else if (host.includes('lmscloud') || host.includes('cms')) {
    reasons.push('non-deterministic LMS/CMS-like host; no rewrite applied');
  }

  stripApiPath(parsed, normalizeApi(options.api), reasons);

  const normalizedUrl = parsed.toString();
  if (normalizedUrl !== cleaned) {
    reasons.push('canonicalized URL serialization');
  }

  return {
    normalizedUrl,
    reasons,
    rewritten,
    rewriteFromHost,
    rewriteToHost,
  };
};
