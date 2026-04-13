import type { LibrarySystemAdapter } from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { SisisAdapter } from '@/src/infrastructure/opac/adapters/SisisAdapter';
import { UnsupportedAdapter } from '@/src/infrastructure/opac/adapters/UnsupportedAdapter';
import { VuFindAdapter } from '@/src/infrastructure/opac/adapters/VuFindAdapter';

export const createLibrarySystemAdapter = (
  provider: OpacappNormalizedProvider,
): LibrarySystemAdapter => {
  const api = provider.api.toLowerCase();

  if (api === 'sisis') {
    return new SisisAdapter(provider);
  }

  if (api === 'vufind') {
    return new VuFindAdapter(provider);
  }

  return new UnsupportedAdapter(provider);
};
