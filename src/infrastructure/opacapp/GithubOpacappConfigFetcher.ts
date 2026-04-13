import type { OpacappRawConfig } from '@/src/domain/models/opacapp';

export type GithubFileDescriptor = {
  path: string;
  name: string;
  downloadUrl: string;
};

export type GithubOpacappFetcherOptions = {
  owner?: string;
  repo?: string;
  ref?: string;
  token?: string;
};

export class GithubOpacappConfigFetcher {
  private owner: string;
  private repo: string;
  private ref: string;
  private token?: string;

  constructor(options: GithubOpacappFetcherOptions = {}) {
    this.owner = options.owner ?? 'opacapp';
    this.repo = options.repo ?? 'opacapp-config-files';
    this.ref = options.ref ?? 'master';
    this.token = options.token;
  }

  get sourceRef(): string {
    return this.ref;
  }

  get repository(): string {
    return `${this.owner}/${this.repo}`;
  }

  async listBibConfigs(): Promise<GithubFileDescriptor[]> {
    const treeUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${this.ref}?recursive=1`;
    const tree = await this.fetchJson(treeUrl);
    const files = Array.isArray(tree?.tree) ? tree.tree : [];

    return files
      .filter((entry: { path?: string; type?: string }) =>
        entry.type === 'blob' && typeof entry.path === 'string' && entry.path.startsWith('bibs/') && entry.path.endsWith('.json'),
      )
      .map((entry: { path: string }) => {
        const name = entry.path.split('/').pop() ?? entry.path;
        return {
          path: entry.path,
          name,
          downloadUrl: `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.ref}/${entry.path}`,
        };
      });
  }

  async fetchBibConfig(descriptor: GithubFileDescriptor): Promise<OpacappRawConfig> {
    return this.fetchJson(descriptor.downloadUrl);
  }

  private async fetchJson(url: string): Promise<any> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'openlib-provider-importer',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub fetch failed (${response.status}) for ${url}: ${body}`);
    }

    return response.json();
  }
}
