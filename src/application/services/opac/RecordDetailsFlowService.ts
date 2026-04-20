import type { OpacAvailability, OpacBriefRecord, OpacIdentifier, OpacRecord } from '@/src/domain/models/opac';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { googleBooksEnrichment } from '@/src/infrastructure/enrichment/GoogleBooksEnrichment';
import { createLibrarySystemAdapter } from '@/src/infrastructure/opac/AdapterRegistry';

const findLegacyDetailUrl = (identifiers?: OpacIdentifier[]) => {
  const candidate = identifiers?.find((id) => id.system === 'local')?.value;
  if (!candidate) return undefined;
  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    return candidate;
  }
  return undefined;
};

const mergeIdentifiers = (
  base?: OpacIdentifier[],
  extra?: OpacIdentifier[],
): OpacIdentifier[] | undefined => {
  const combined = [...(base ?? []), ...(extra ?? [])];
  if (combined.length === 0) return undefined;
  const seen = new Set<string>();
  return combined.filter((entry) => {
    const key = `${entry.system}:${entry.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const mergeRecord = (
  base: OpacBriefRecord,
  details: OpacRecord | null,
  fallbackDetailUrl?: string,
): OpacRecord => {
  const detailUrl = details?.detailUrl ?? base.detailUrl ?? fallbackDetailUrl;

  return {
    id: details?.id ?? base.id,
    title: details?.title?.trim() ? details.title : base.title,
    authors: details?.authors?.length ? details.authors : base.authors,
    detailUrl: detailUrl ?? undefined,
    publishedYear: details?.publishedYear ?? base.publishedYear,
    format: details?.format ?? base.format,
    identifiers: mergeIdentifiers(base.identifiers, details?.identifiers),
    coverUrl: details?.coverUrl ?? base.coverUrl,
    description: details?.description,
    subjects: details?.subjects,
    language: details?.language,
    publisher: details?.publisher,
    holdings: details?.holdings,
  };
};

export class RecordDetailsFlowService {
  async fetchDetails(
    provider: OpacappNormalizedProvider,
    record: OpacBriefRecord,
  ): Promise<{ record: OpacRecord; availability: OpacAvailability | null }> {
    const adapter = createLibrarySystemAdapter(provider);
    const legacyDetailUrl = findLegacyDetailUrl(record.identifiers);
    const detailUrl = record.detailUrl ?? legacyDetailUrl;

    const [details, availability] = await Promise.all([
      adapter.details({ recordId: record.id, detailUrl }),
      adapter.availability
        ? adapter.availability({ recordId: record.id }).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (!details) {
      throw new Error('Details are not available for this record yet.');
    }

    let mergedRecord = mergeRecord(record, details, detailUrl);

    try {
      const enrichment = googleBooksEnrichment();
      mergedRecord = await enrichment.enrichRecord(mergedRecord);
    } catch (error) {
      console.warn('[RecordDetailsFlowService] Google Books enrichment failed', error);
    }

    return {
      record: mergedRecord,
      availability,
    };
  }
}
