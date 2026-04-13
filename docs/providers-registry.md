# Providers Registry Import

OpenLib can ingest OPAC provider configurations from the `opacapp/opacapp-config-files` GitHub repository and build a normalized registry.

## What It Does
- Pulls `bibs/*.json` entries from the upstream repo via GitHub API.
- Normalizes each entry into a consistent provider object (`api`, `baseUrl`, `authHint`, etc.).
- Writes a registry file to `data/providers.registry.json`.

## Run The Importer
1. Install dependencies: `npm install`
2. Build the registry: `npm run build:providers`

### Optional GitHub Token
For higher rate limits, set a GitHub token:

```bash
GITHUB_TOKEN=your_token_here npm run build:providers
```

The importer uses the GitHub API by default and will fall back to the HTML listing if the API is rate-limited.

## Output
The registry includes:
- `providers`: normalized providers
- `issues`: any files that failed validation or fetch
- `totals`: summary counts

## Provider Smoke Test
Run a lightweight compatibility check against the registry and generate status artifacts:

1. Ensure the registry exists: `npm run build:providers`
2. Run the smoke test: `npm run test:providers`

The test validates required fields, probes each `baseUrl` with a timeout, and writes:
- `artifacts/provider-status/status.json` (machine-readable)
- `artifacts/provider-status/status.md` (human-readable summary)

Optional environment overrides:
- `PROVIDER_TEST_TIMEOUT_MS` (default: `4500`)
- `PROVIDER_TEST_CONCURRENCY` (default: `6`)
