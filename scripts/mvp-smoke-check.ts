import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type CheckStatus = 'pass' | 'fail';

type CheckResult = {
  id: string;
  label: string;
  status: CheckStatus;
  details?: string;
};

type ProvidersRegistry = {
  totals?: {
    files?: number;
    providers?: number;
    issues?: number;
  };
  providers?: Array<{ api?: string }>;
};

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'data', 'providers.registry.json');
const PROVIDER_STATUS_PATH = path.join(ROOT, 'artifacts', 'provider-status', 'status.json');
const HEARTBEAT_DIR = path.join(ROOT, 'artifacts', 'heartbeat');
const HEARTBEAT_JSON_PATH = path.join(HEARTBEAT_DIR, 'openlib-status.json');
const HEARTBEAT_MD_PATH = path.join(HEARTBEAT_DIR, 'openlib-status.md');

const REQUIRED_SCREENS = [
  'src/presentation/screens/SearchScreen.tsx',
  'src/presentation/screens/AccountScreen.tsx',
  'src/presentation/screens/ReminderSettingsScreen.tsx',
  'src/presentation/screens/ReminderHistoryScreen.tsx',
];

const REQUIRED_STORES = [
  'src/application/state/RecentSearchesStore.tsx',
  'src/application/state/AccountSessionStore.tsx',
  'src/application/state/ReminderPreferencesStore.tsx',
  'src/application/state/ActiveLibraryStore.tsx',
];

const exists = async (target: string) => {
  try {
    await readFile(target, 'utf-8');
    return true;
  } catch {
    return false;
  }
};

const readJson = async <T,>(target: string): Promise<T | null> => {
  try {
    const raw = await readFile(target, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const summarizeMissing = (missing: string[]) =>
  missing.length === 0 ? 'All required files present.' : `Missing: ${missing.join(', ')}`;

const formatChecklistLine = (check: CheckResult) => {
  const box = check.status === 'pass' ? '[x]' : '[ ]';
  const details = check.details ? ` — ${check.details}` : '';
  return `- ${box} ${check.label}${details}`;
};

const run = async () => {
  const checks: CheckResult[] = [];
  const generatedAt = new Date().toISOString();

  const registryExists = await exists(REGISTRY_PATH);
  let registry: ProvidersRegistry | null = null;

  if (registryExists) {
    registry = await readJson<ProvidersRegistry>(REGISTRY_PATH);
  }

  checks.push({
    id: 'providers-registry-exists',
    label: 'Providers registry exists',
    status: registryExists && Boolean(registry) ? 'pass' : 'fail',
    details: registryExists ? 'data/providers.registry.json' : 'Missing data/providers.registry.json',
  });

  const totals = registry?.totals ?? null;
  const providers = Array.isArray(registry?.providers) ? registry?.providers ?? [] : [];
  const totalsValid =
    Boolean(totals) &&
    typeof totals?.files === 'number' &&
    typeof totals?.providers === 'number' &&
    totals.providers > 0 &&
    providers.length > 0 &&
    totals.providers === providers.length;

  checks.push({
    id: 'providers-registry-counts',
    label: 'Providers registry has counts',
    status: totalsValid ? 'pass' : 'fail',
    details: totalsValid
      ? `providers=${providers.length}, files=${totals?.files ?? 0}`
      : 'Totals/providers mismatch or missing counts',
  });

  const sisisCount = providers.filter(
    (provider) => provider.api?.toLowerCase() === 'sisis',
  ).length;
  const vufindCount = providers.filter(
    (provider) => provider.api?.toLowerCase() === 'vufind',
  ).length;

  checks.push({
    id: 'providers-registry-sisis',
    label: 'SISIS provider present',
    status: sisisCount > 0 ? 'pass' : 'fail',
    details: `sisis=${sisisCount}`,
  });

  checks.push({
    id: 'providers-registry-vufind',
    label: 'VuFind provider present',
    status: vufindCount > 0 ? 'pass' : 'fail',
    details: `vufind=${vufindCount}`,
  });

  const statusArtifact = await readJson<Record<string, unknown>>(PROVIDER_STATUS_PATH);
  checks.push({
    id: 'provider-status-artifact',
    label: 'Provider status artifact exists',
    status: statusArtifact ? 'pass' : 'fail',
    details: statusArtifact
      ? 'artifacts/provider-status/status.json'
      : 'Missing artifacts/provider-status/status.json',
  });

  const storagePath = path.join(ROOT, 'src', 'infrastructure', 'storage', 'PersistentStorage.ts');
  const storageSource = await readFile(storagePath, 'utf-8').catch(() => '');
  const storageChecks = [
    { key: 'activeLibraryId', pattern: /activeLibraryId\s*:\s*['"]activeLibraryId['"]/ },
    { key: 'accountSession', pattern: /accountSession\s*:\s*['"]accountSession['"]/ },
    {
      key: 'reminderPreferences',
      pattern: /reminderPreferences\s*:\s*['"]reminderPreferences['"]/,
    },
    {
      key: 'recentSearches',
      pattern: /recentSearches\s*:\s*\([^)]*\)\s*=>\s*`recentSearches\.\$\{/,
    },
  ];
  const missingStorageKeys = storageChecks
    .filter((entry) => !entry.pattern.test(storageSource))
    .map((entry) => entry.key);

  const storePathChecks = [
    {
      path: path.join(ROOT, 'src', 'application', 'state', 'AccountSessionStore.tsx'),
      required: ['storageKeys.accountSession'],
    },
    {
      path: path.join(ROOT, 'src', 'application', 'state', 'ReminderPreferencesStore.tsx'),
      required: ['storageKeys.reminderPreferences'],
    },
    {
      path: path.join(ROOT, 'src', 'application', 'state', 'RecentSearchesStore.tsx'),
      required: ['storageKeys.recentSearches'],
    },
    {
      path: path.join(ROOT, 'src', 'application', 'state', 'ActiveLibraryStore.tsx'),
      required: ['storageKeys.activeLibraryId'],
    },
  ];

  const missingStoreRefs: string[] = [];
  for (const entry of storePathChecks) {
    const content = await readFile(entry.path, 'utf-8').catch(() => '');
    for (const token of entry.required) {
      if (!content.includes(token)) {
        missingStoreRefs.push(`${path.relative(ROOT, entry.path)}:${token}`);
      }
    }
  }

  const persistenceOk = missingStorageKeys.length === 0 && missingStoreRefs.length === 0;
  const persistenceDetails = [
    missingStorageKeys.length > 0
      ? `Missing storageKeys: ${missingStorageKeys.join(', ')}`
      : 'storageKeys present',
    missingStoreRefs.length > 0
      ? `Missing references: ${missingStoreRefs.join(', ')}`
      : 'store references present',
  ].join('; ');

  checks.push({
    id: 'persistence-keys',
    label: 'Persistence keys and schemas are wired',
    status: persistenceOk ? 'pass' : 'fail',
    details: persistenceDetails,
  });

  const missingScreens: string[] = [];
  for (const screen of REQUIRED_SCREENS) {
    const target = path.join(ROOT, screen);
    if (!(await exists(target))) {
      missingScreens.push(screen);
    }
  }

  checks.push({
    id: 'mvp-screens',
    label: 'MVP screens present (search/account/reminders)',
    status: missingScreens.length === 0 ? 'pass' : 'fail',
    details: summarizeMissing(missingScreens),
  });

  const missingStores: string[] = [];
  for (const store of REQUIRED_STORES) {
    const target = path.join(ROOT, store);
    if (!(await exists(target))) {
      missingStores.push(store);
    }
  }

  checks.push({
    id: 'mvp-stores',
    label: 'MVP stores present (search/account/reminders)',
    status: missingStores.length === 0 ? 'pass' : 'fail',
    details: summarizeMissing(missingStores),
  });

  const summary = {
    checks: checks.length,
    passed: checks.filter((check) => check.status === 'pass').length,
    failed: checks.filter((check) => check.status === 'fail').length,
  };

  const payload = {
    generatedAt,
    summary,
    checks,
  };

  const mdLines = [
    '# OpenLib MVP Smoke Check',
    '',
    `Generated: ${generatedAt}`,
    `Checks: ${summary.checks}`,
    `Passed: ${summary.passed}`,
    `Failed: ${summary.failed}`,
    '',
    '## Checklist',
    '',
    ...checks.map(formatChecklistLine),
    '',
  ];

  await mkdir(HEARTBEAT_DIR, { recursive: true });
  await writeFile(HEARTBEAT_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  await writeFile(HEARTBEAT_MD_PATH, `${mdLines.join('\n')}\n`, 'utf-8');

  console.log(`Checks: ${summary.checks}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Heartbeat JSON: ${HEARTBEAT_JSON_PATH}`);
  console.log(`Heartbeat MD: ${HEARTBEAT_MD_PATH}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
