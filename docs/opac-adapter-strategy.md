# Openlib OPAC Adapter Strategy (SISIS / VuFind)

## Goal
Port the proven adapter pattern from `opacclient` (Java) into a TypeScript architecture that supports multiple OPAC systems behind one consistent interface.

## Findings from legacy adapters

### SISIS (Java `SISIS.java`)
- Session-oriented flow with known endpoints:
  - `/start.do`
  - `/search.do?methodToCall=submit`
  - `/hitList.do?methodToCall=pos`
  - `/singleHit.do`
- Heavy HTML parsing with system-specific selectors.
- Uses config-driven `baseurl` and optional account features.
- Media-type mapping table is extensive and should be externalized in TS config.

### VuFind (Java `VuFind.java`)
- Search flow typically via `/Search/Results` (+ query params).
- Detail flow via `/Record/:id` style URLs.
- Supports hidden filters / branch scoping from config.
- Also strongly parser-driven (HTML DOM selectors + regex patterns).

## Proposed TypeScript adapter contract

Create a new provider adapter port extending the current OPAC abstraction:

```ts
export interface LibrarySystemAdapter {
  system: 'sisis' | 'vufind' | string;

  search(input: {
    query: string;
    page?: number;
    filters?: Record<string, string | string[]>;
  }): Promise<OpacSearchResult>;

  details(input: { recordId: string }): Promise<OpacRecord | null>;

  availability?(input: { recordId: string }): Promise<OpacAvailability>;

  accountLogin?(input: {
    username: string;
    password: string;
    extra?: Record<string, string>;
  }): Promise<{ ok: boolean; message?: string }>;
}
```

## Runtime routing

Use normalized provider registry (`data/providers.registry.json`) to choose adapter:
- `provider.api === 'sisis'` => `SisisAdapter`
- `provider.api === 'vufind'` => `VuFindAdapter`
- unknown => `UnsupportedAdapter` with meaningful error

## File plan (next dev ticket)

- `src/application/ports/LibrarySystemAdapter.ts`
- `src/infrastructure/opac/adapters/SisisAdapter.ts`
- `src/infrastructure/opac/adapters/VuFindAdapter.ts`
- `src/infrastructure/opac/parsers/sisis/*`
- `src/infrastructure/opac/parsers/vufind/*`
- `src/infrastructure/opac/AdapterRegistry.ts`

## Parsing strategy

1. Keep parser logic system-specific and isolated.
2. Normalize into domain models only at adapter boundary.
3. Prefer resilient selectors + fallback selectors per field.
4. Track parser confidence/errors for observability.

## Incremental implementation order

1. `SisisAdapter.search` + result list parsing (MVP)
2. `SisisAdapter.details` + holdings extraction
3. `VuFindAdapter.search`
4. `VuFindAdapter.details`
5. Shared utilities (URL building, text cleanup, availability normalization)
6. Optional account flows after search/detail is stable

## Risks / notes

- HTML structure variance between libraries is high.
- Session/cookie handling differs by installation.
- Need screenshot/fixture-based parser QA from real catalogs.
- Keep adapter behavior configurable via provider `data` fields.

## Current MVP (Ticket #468)

- Implemented `SisisAdapter.search` using a `start.do` → `search.do` → `hitList.do` flow with cookie capture and graceful fallback.
- Parser uses resilient selectors + anchor-based fallback; IDs map from detail URLs when explicit identifiers are missing.
- Demo script: `npm run sisis:demo` (uses the first SISIS provider in `data/providers.registry.json`).
- TODO: tighten selectors per-installation and add fixture-based parser tests once we capture real HTML samples.

## Current MVP (Ticket #469)

- Implemented `VuFindAdapter.search` against `/Search/Results` with `lookfor`, `type`, `page`, `limit`, and optional `filter[]` params.
- Parser uses resilient selectors with fallbacks for title/author/format/year/cover, maps detail URLs, and derives stable IDs when explicit identifiers are missing.
- Demo script: `npm run vufind:demo` (uses the first VuFind provider in `data/providers.registry.json`).
