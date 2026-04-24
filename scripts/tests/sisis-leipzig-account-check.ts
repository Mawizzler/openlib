import { createLibrarySystemAdapter } from '@/src/infrastructure/opac/AdapterRegistry';
import { providersRegistryRepository } from '@/src/infrastructure/providers/ProvidersRegistryRepository';

const providerId = '8714';

const run = async () => {
  const username = process.env.LEIPZIG_USER ?? '';
  const password = process.env.LEIPZIG_PASS ?? '';

  if (!username || !password) {
    console.error('Missing LEIPZIG_USER/LEIPZIG_PASS env vars.');
    process.exit(1);
  }

  const provider = providersRegistryRepository.getProviderById(providerId);
  if (!provider) {
    console.error(`Provider ${providerId} not found.`);
    process.exit(1);
  }

  const adapter = createLibrarySystemAdapter(provider);
  const login = await adapter.accountLogin({ username, password });

  if (login.status !== 'success' || !login.session || !login.identity) {
    console.error(`Login failed: ${login.status} ${login.message ?? ''}`.trim());
    process.exit(1);
  }

  const snapshotResult = await adapter.fetchAccountSnapshot({
    identity: login.identity,
    session: login.session,
  });

  if (snapshotResult.status !== 'success' || !snapshotResult.snapshot) {
    console.error(`Snapshot failed: ${snapshotResult.status} ${snapshotResult.message ?? ''}`.trim());
    process.exit(1);
  }

  const { loans, reservations } = snapshotResult.snapshot;
  console.log(`Loans: ${loans.length}`);
  if (loans.length > 0) {
    const first = loans[0];
    console.log('First loan:', {
      id: first.id,
      title: first.title,
      dueDate: first.dueDate,
      status: first.status,
    });
  }

  console.log(`Reservations: ${reservations.length}`);
  if (reservations.length > 0) {
    const first = reservations[0];
    console.log('First reservation:', {
      id: first.id,
      title: first.title,
      pickupByDate: first.pickupByDate,
      pickupLocation: first.pickupLocation,
      status: first.status,
    });
  }
};

run().catch((error) => {
  console.error('Leipzig SISIS account check failed:', error);
  process.exit(1);
});
