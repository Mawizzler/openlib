import type { LibrarySystemAdapter } from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { BibliothecaAdapter } from '@/src/infrastructure/opac/adapters/BibliothecaAdapter';
import { SisisAdapter } from '@/src/infrastructure/opac/adapters/SisisAdapter';
import { OpenAdapter } from '@/src/infrastructure/opac/adapters/OpenAdapter';
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

  if (api === 'bibliotheca') {
    return new BibliothecaAdapter(provider);
  }

  if (api === 'open') {
    return new OpenAdapter(provider);
  }

  return new UnsupportedAdapter(provider);
};
