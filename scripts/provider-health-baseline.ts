import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Classification = 'usable_records' | 'deterministic_no_records';
type ProviderHealthStatus = 'green' | 'red' | 'unsupported';

type ProviderHealthRow = {
  providerId?: string;
  status?: ProviderHealthStatus;
  classification?: Classification;
};

type ProviderHealthMatrix = {
  generatedAt?: string;
  totals?: {
    providers?: number;
    green?: number;
    red?: number;
    unsupported?: number;
    usable_records?: number;
    deterministic_no_records?: number;
  };
  providerSets?: {
    usable_records?: string[];
    deterministic_no_records?: string[];
  };
  matrix?: ProviderHealthRow[];
};

type MatrixSummary = {
  providers: number;
  green: number;
  red: number;
  unsupported: number;
  usable_records: number;
  deterministic_no_records: number;
};

type DriftReport = {
  timestamp: string;
  current: string;
  previous: string | null;
  delta: MatrixSummary;
  changedProviders: number;
  improved: number;
  regressed: number;
  deterministicNoRecordsChanged: number;
  usableRecordsRegressions: number;
  deterministicNoRecordsAdded: string[];
  deterministicNoRecordsRemoved: string[];
  usableRecordsRegressedProviderIds: string[];
};

const MATRIX_PATH = path.join(process.cwd(), 'artifacts', 'provider-health-matrix', 'matrix.json');
const BASELINES_DIR = path.join(process.cwd(), 'artifacts', 'provider-health-matrix', 'baselines');

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
};

const toCompactTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '');
  }

  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}${minutes}${seconds}Z`;
};

const normalizeProviderIds = (values: Iterable<string | undefined>): string[] =>
  Array.from(
    new Set(
      Array.from(values)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim()),
    ),
  ).sort();

const getProviderSet = (matrix: ProviderHealthMatrix, classification: Classification): string[] => {
  const explicit = matrix.providerSets?.[classification];
  if (Array.isArray(explicit)) {
    return normalizeProviderIds(explicit);
  }
  return normalizeProviderIds(
    (matrix.matrix ?? [])
      .filter((row) => row.classification === classification)
      .map((row) => row.providerId),
  );
};

const getSummary = (matrix: ProviderHealthMatrix): MatrixSummary => {
  const rows = matrix.matrix ?? [];
  const usableRecords = getProviderSet(matrix, 'usable_records');
  const deterministicNoRecords = getProviderSet(matrix, 'deterministic_no_records');

  return {
    providers: matrix.totals?.providers ?? rows.length,
    green: matrix.totals?.green ?? rows.filter((row) => row.status === 'green').length,
    red: matrix.totals?.red ?? rows.filter((row) => row.status === 'red').length,
    unsupported: matrix.totals?.unsupported ?? rows.filter((row) => row.status === 'unsupported').length,
    usable_records: matrix.totals?.usable_records ?? usableRecords.length,
    deterministic_no_records: matrix.totals?.deterministic_no_records ?? deterministicNoRecords.length,
  };
};

const subtractSummary = (current: MatrixSummary, previous: MatrixSummary): MatrixSummary => ({
  providers: current.providers - previous.providers,
  green: current.green - previous.green,
  red: current.red - previous.red,
  unsupported: current.unsupported - previous.unsupported,
  usable_records: current.usable_records - previous.usable_records,
  deterministic_no_records: current.deterministic_no_records - previous.deterministic_no_records,
});

const getStatusMap = (matrix: ProviderHealthMatrix): Map<string, ProviderHealthStatus> =>
  new Map(
    (matrix.matrix ?? [])
      .filter(
        (row): row is Required<Pick<ProviderHealthRow, 'providerId' | 'status'>> & ProviderHealthRow =>
          typeof row.providerId === 'string' &&
          row.providerId.trim().length > 0 &&
          (row.status === 'green' || row.status === 'red' || row.status === 'unsupported'),
      )
      .map((row) => [row.providerId.trim(), row.status]),
  );

const buildMarkdown = (report: DriftReport) => {
  const lines = [
    `# Provider health drift (${report.timestamp})`,
    '',
    `- Current: \`${report.current}\``,
    `- Previous: ${report.previous ? `\`${report.previous}\`` : 'none'}`,
    `- Δ providers: ${report.delta.providers}`,
    `- Δ green: ${report.delta.green}`,
    `- Δ red: ${report.delta.red}`,
    `- Δ unsupported: ${report.delta.unsupported}`,
    `- Δ usable_records: ${report.delta.usable_records}`,
    `- Δ deterministic_no_records: ${report.delta.deterministic_no_records}`,
    `- changedProviders: ${report.changedProviders}`,
    `- improved: ${report.improved}`,
    `- regressed: ${report.regressed}`,
    `- deterministic_no_records changes: ${report.deterministicNoRecordsChanged}`,
    `- usable_records regressions: ${report.usableRecordsRegressions}`,
    '',
  ];

  if (report.usableRecordsRegressedProviderIds.length > 0) {
    lines.push('## usable_records regressions');
    for (const providerId of report.usableRecordsRegressedProviderIds) {
      lines.push(`- ${providerId}`);
    }
    lines.push('');
  }

  if (report.deterministicNoRecordsAdded.length > 0) {
    lines.push('## deterministic_no_records added');
    for (const providerId of report.deterministicNoRecordsAdded) {
      lines.push(`- ${providerId}`);
    }
    lines.push('');
  }

  if (report.deterministicNoRecordsRemoved.length > 0) {
    lines.push('## deterministic_no_records removed');
    for (const providerId of report.deterministicNoRecordsRemoved) {
      lines.push(`- ${providerId}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

const run = async () => {
  const matrix = await readJson<ProviderHealthMatrix>(MATRIX_PATH);
  const generatedAt = matrix.generatedAt ?? new Date().toISOString();
  const timestamp = toCompactTimestamp(generatedAt);

  await mkdir(BASELINES_DIR, { recursive: true });

  const baselineFile = `matrix-${timestamp}.json`;
  const baselinePath = path.join(BASELINES_DIR, baselineFile);
  await copyFile(MATRIX_PATH, baselinePath);

  const baselineFiles = (await readdir(BASELINES_DIR))
    .filter((file) => /^matrix-.*\.json$/.test(file) && file !== baselineFile)
    .sort();
  const previousFile = baselineFiles.at(-1) ?? null;
  const currentSummary = getSummary(matrix);

  let previousMatrix: ProviderHealthMatrix | null = null;
  let previousSummary: MatrixSummary = {
    providers: 0,
    green: 0,
    red: 0,
    unsupported: 0,
    usable_records: 0,
    deterministic_no_records: 0,
  };

  if (previousFile) {
    previousMatrix = await readJson<ProviderHealthMatrix>(path.join(BASELINES_DIR, previousFile));
    previousSummary = getSummary(previousMatrix);
  }

  const currentStatuses = getStatusMap(matrix);
  const previousStatuses = previousMatrix ? getStatusMap(previousMatrix) : new Map<string, ProviderHealthStatus>();
  const statusProviderIds = normalizeProviderIds([...currentStatuses.keys(), ...previousStatuses.keys()]);

  let changedProviders = 0;
  let improved = 0;
  let regressed = 0;

  for (const providerId of statusProviderIds) {
    const previousStatus = previousStatuses.get(providerId);
    const currentStatus = currentStatuses.get(providerId);
    if (previousStatus === currentStatus) {
      continue;
    }
    changedProviders += 1;
    if (previousStatus === 'red' && currentStatus === 'green') {
      improved += 1;
    } else if (previousStatus === 'green' && currentStatus === 'red') {
      regressed += 1;
    }
  }

  const currentUsableRecords = getProviderSet(matrix, 'usable_records');
  const previousUsableRecords = previousMatrix ? getProviderSet(previousMatrix, 'usable_records') : [];
  const currentDeterministicNoRecords = getProviderSet(matrix, 'deterministic_no_records');
  const previousDeterministicNoRecords = previousMatrix ? getProviderSet(previousMatrix, 'deterministic_no_records') : [];

  const usableRecordsRegressedProviderIds = previousUsableRecords.filter((providerId) => !currentUsableRecords.includes(providerId));
  const deterministicNoRecordsAdded = currentDeterministicNoRecords.filter(
    (providerId) => !previousDeterministicNoRecords.includes(providerId),
  );
  const deterministicNoRecordsRemoved = previousDeterministicNoRecords.filter(
    (providerId) => !currentDeterministicNoRecords.includes(providerId),
  );

  const report: DriftReport = {
    timestamp,
    current: baselineFile,
    previous: previousFile,
    delta: subtractSummary(currentSummary, previousSummary),
    changedProviders,
    improved,
    regressed,
    deterministicNoRecordsChanged: deterministicNoRecordsAdded.length + deterministicNoRecordsRemoved.length,
    usableRecordsRegressions: usableRecordsRegressedProviderIds.length,
    deterministicNoRecordsAdded,
    deterministicNoRecordsRemoved,
    usableRecordsRegressedProviderIds,
  };

  const driftJsonPath = path.join(BASELINES_DIR, `drift-${timestamp}.json`);
  const driftMdPath = path.join(BASELINES_DIR, `drift-${timestamp}.md`);

  await writeFile(driftJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  await writeFile(driftMdPath, buildMarkdown(report), 'utf-8');

  console.log(`Baseline snapshot: ${baselinePath}`);
  console.log(`Drift JSON: ${driftJsonPath}`);
  console.log(`Drift MD: ${driftMdPath}`);
  console.log(`usable_records regressions: ${report.usableRecordsRegressions}`);
  console.log(`deterministic_no_records changes: ${report.deterministicNoRecordsChanged}`);

  if (report.usableRecordsRegressions > 0 || report.deterministicNoRecordsChanged > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
