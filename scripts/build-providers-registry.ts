import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { normalizeOpacappConfig } from '../src/application/services/opacapp/normalizeOpacappConfig';
import type {
  OpacappNormalizedProvider,
  OpacappNormalizationIssue,
} from '../src/domain/models/opacapp';
import { GithubOpacappConfigFetcher } from '../src/infrastructure/opacapp/GithubOpacappConfigFetcher';

const OUTPUT_PATH = path.join(process.cwd(), 'data', 'providers.registry.json');

type ConfigFetcher = {
  repository: string;
  sourceRef: string;
  listBibConfigs(): Promise<{ path: string; name: string; downloadUrl: string }[]>;
  fetchBibConfig(descriptor: { path: string; name: string; downloadUrl: string }): Promise<any>;
};

class LocalOpacappConfigFetcher implements ConfigFetcher {
  repository: string;
  sourceRef: string;
  private basePath: string;

  constructor(basePath: string, ref = 'local') {
    this.basePath = basePath;
    this.repository = 'opacapp/opacapp-config-files (local)';
    this.sourceRef = ref;
  }

  async listBibConfigs(): Promise<{ path: string; name: string; downloadUrl: string }[]> {
    const bibsPath = path.join(this.basePath, 'bibs');
    const entries = await readdir(bibsPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => ({
        path: path.posix.join('bibs', entry.name),
        name: entry.name,
        downloadUrl: path.join(bibsPath, entry.name),
      }));
  }

  async fetchBibConfig(descriptor: { downloadUrl: string }): Promise<any> {
    const raw = await readFile(descriptor.downloadUrl, 'utf-8');
    return JSON.parse(raw);
  }
}

const fetchHtmlListing = async (owner: string, repo: string, ref: string) => {
  const listingUrl = `https://github.com/${owner}/${repo}/tree/${ref}/bibs`;
  const response = await fetch(listingUrl, { headers: { 'User-Agent': 'openlib-provider-importer' } });
  if (!response.ok) {
    throw new Error(`HTML listing failed (${response.status}) for ${listingUrl}`);
  }
  const html = await response.text();
  const pattern = new RegExp(`href=\\\"\\/[^\\\"]+\\/blob\\/${ref}\\/bibs\\/([^\\\"]+\\.json)\\\"`, 'g');
  const matches = [...html.matchAll(pattern)];
  const names = Array.from(new Set(matches.map((match) => match[1])));
  return names.map((name) => ({
    path: path.posix.join('bibs', name),
    name,
    downloadUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/bibs/${name}`,
  }));
};

const run = async () => {
  const token = process.env.GITHUB_TOKEN;
  const localPath = process.env.OPACAPP_CONFIG_LOCAL_PATH;
  const fetcher: ConfigFetcher = localPath
    ? new LocalOpacappConfigFetcher(localPath, process.env.OPACAPP_CONFIG_REF)
    : new GithubOpacappConfigFetcher({ token });

  let files = await fetcher.listBibConfigs().catch(async (error) => {
    if (fetcher instanceof GithubOpacappConfigFetcher) {
      console.warn('GitHub API listing failed, attempting HTML fallback.');
      return fetchHtmlListing('opacapp', 'opacapp-config-files', fetcher.sourceRef);
    }
    throw error;
  });
  const providers: OpacappNormalizedProvider[] = [];
  const issues: { file: string; problems: OpacappNormalizationIssue[] }[] = [];

  for (const file of files) {
    try {
      const raw = await fetcher.fetchBibConfig(file);
      const result = normalizeOpacappConfig(raw, {
        repository: fetcher.repository,
        path: file.path,
        file: file.name,
        ref: fetcher.sourceRef,
      });

      if (result.provider) {
        providers.push(result.provider);
      } else {
        issues.push({ file: file.name, problems: result.issues });
      }
    } catch (error) {
      issues.push({
        file: file.name,
        problems: [{ field: 'fetch', message: error instanceof Error ? error.message : 'Unknown error' }],
      });
    }
  }

  providers.sort((a, b) => a.title.localeCompare(b.title));

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      repository: fetcher.repository,
      ref: fetcher.sourceRef,
      path: 'bibs/*.json',
    },
    totals: {
      files: files.length,
      providers: providers.length,
      issues: issues.length,
    },
    providers,
    issues,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');

  console.log(`Providers registry written to ${OUTPUT_PATH}`);
  console.log(`Files: ${files.length}`);
  console.log(`Providers: ${providers.length}`);
  console.log(`Issues: ${issues.length}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
