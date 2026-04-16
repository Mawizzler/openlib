import type { LibrarySystemAdapter } from '@/src/application/ports/LibrarySystemAdapter';
import type { OpacappNormalizedProvider } from '@/src/domain/models/opacapp';
import { BibliothecaAdapter } from '@/src/infrastructure/opac/adapters/BibliothecaAdapter';
import { SisisAdapter } from '@/src/infrastructure/opac/adapters/SisisAdapter';
import { OpenAdapter } from '@/src/infrastructure/opac/adapters/OpenAdapter';
import { PicaAdapter } from '@/src/infrastructure/opac/adapters/PicaAdapter';
import { UnsupportedAdapter } from '@/src/infrastructure/opac/adapters/UnsupportedAdapter';
import { VuFindAdapter } from '@/src/infrastructure/opac/adapters/VuFindAdapter';
import { WebOpacNetAdapter } from '@/src/infrastructure/opac/adapters/WebOpacNetAdapter';

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

  if (api === 'webopac.net') {
    return new WebOpacNetAdapter(provider);
  }

  if (api === 'pica') {
    return new PicaAdapter(provider);
  }

  return new UnsupportedAdapter(provider);
};
