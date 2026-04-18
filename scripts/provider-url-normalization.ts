export type ProviderUrlNormalizationResult = {
  normalizedUrl: string | null;
  reasons: string[];
};

const QUOTE_TRIM_PATTERN = /^["'`\s]+|["'`\s]+$/g;

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

export const normalizeProviderBaseUrl = (rawBaseUrl: string): ProviderUrlNormalizationResult => {
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
    return { normalizedUrl: null, reasons };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    reasons.push(`unsupported URL scheme: ${parsed.protocol}`);
    return { normalizedUrl: null, reasons };
  }

  const normalizedUrl = parsed.toString();
  if (normalizedUrl !== cleaned) {
    reasons.push('canonicalized URL serialization');
  }

  return {
    normalizedUrl,
    reasons,
  };
};
