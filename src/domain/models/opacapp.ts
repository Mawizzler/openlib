export type OpacappAuthHint = 'none' | 'opac' | 'sru' | 'unknown';

export type OpacappRawConfig = {
  api?: string;
  title?: string;
  library_id?: number | string;
  city?: string;
  state?: string;
  country?: string;
  geo?: [number, number];
  account_supported?: boolean;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type OpacappConfigSource = {
  repository: string;
  path: string;
  file: string;
  ref: string;
};

export type OpacappProviderLocation = {
  city?: string;
  state?: string;
  country?: string;
  geo?: [number, number];
};

export type OpacappNormalizedProvider = {
  id: string;
  title: string;
  api: string;
  baseUrl: string;
  healthStatus?: 'green' | 'red' | 'unsupported' | 'unknown';
  authHint: OpacappAuthHint;
  location?: OpacappProviderLocation;
  accountSupported?: boolean;
  source: OpacappConfigSource;
};

export type OpacappNormalizationIssue = {
  field: string;
  message: string;
};
