import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_PORT = Number.parseInt(process.env.OPENLIB_WEB_PORT ?? '19006', 10) || 19006;
const DEFAULT_BASE_URL = process.env.OPENLIB_BASE_URL ?? `http://127.0.0.1:${DEFAULT_PORT}`;
const OUTPUT_DIR =
  process.env.OPENLIB_QA_OUTPUT_DIR ??
  path.resolve(process.cwd(), 'docs/qa/dark-mode-2026-04-14');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHttpOk(url, { timeoutMs = 90_000 } = {}) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (response.ok) {
        const text = await response.text();
        if (text && text.length > 0) return;
      }
      lastError = new Error(`HTTP not ok: ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await sleep(750);
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function startExpoWebServer({ port }) {
  const child = spawn('npm', ['run', 'web', '--', '--port', String(port)], {
    stdio: 'pipe',
    env: {
      ...process.env,
      CI: process.env.CI ?? '1',
      EXPO_NO_TELEMETRY: process.env.EXPO_NO_TELEMETRY ?? '1',
      BROWSER: process.env.BROWSER ?? 'none',
    },
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));

  return child;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function run() {
  await ensureDir(OUTPUT_DIR);

  const results = {
    ticket: 480,
    date: '2026-04-14',
    baseUrl: DEFAULT_BASE_URL,
    port: DEFAULT_PORT,
    outputDir: OUTPUT_DIR,
    darkMode: true,
    screens: [],
    issues: [],
  };

  const server = startExpoWebServer({ port: DEFAULT_PORT });
  try {
    await waitForHttpOk(DEFAULT_BASE_URL);

    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const context = await browser.newContext({
      colorScheme: 'dark',
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    const ensureHome = async () => {
      for (let i = 0; i < 4; i += 1) {
        if (await page.getByText('Discover', { exact: true }).isVisible().catch(() => false)) {
          return;
        }
        const back = page.getByText('Back', { exact: true }).first();
        if (await back.isVisible().catch(() => false)) {
          await back.click();
          await page.waitForTimeout(150);
          continue;
        }
        break;
      }
      await page.getByText('Discover', { exact: true }).waitFor({ timeout: 5_000 });
    };

    const snap = async (name) => {
      const filename = `${name}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);
      await page.screenshot({ path: filepath, fullPage: true });
      results.screens.push({ name, filename, ok: true });
    };

    const step = async (name, fn) => {
      try {
        await fn();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.screens.push({ name, filename: null, ok: false, error: message });
        results.issues.push(`${name}: ${message}`);
      }
    };

    await page.goto(DEFAULT_BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.getByText('Discover', { exact: true }).waitFor({ timeout: 60_000 });

    await step('home', async () => {
      await snap('01-home');
    });

    await step('search', async () => {
      await page.getByText('Start search', { exact: true }).click();
      await page.getByText('Search', { exact: true }).waitFor();
      await snap('02-search-empty');
    });

    await step('library-picker', async () => {
      await page.getByText('Choose a library', { exact: true }).click();
      await page.getByText('Choose your library', { exact: true }).waitFor();
      await snap('03-library-picker');

      await page.getByPlaceholder('Search by name, city, or ID').fill('8840');
      await page.getByText('Behördenbibliotheken', { exact: true }).click();
      await page.getByText('Search', { exact: true }).waitFor();
      await page.getByText('Behördenbibliotheken', { exact: true }).waitFor();
      await snap('04-search-with-library');
    });

    await step('search-results', async () => {
      await page.getByPlaceholder('Search by title, author, or keyword').fill('goethe');
      await page.getByText('Search', { exact: true }).click();
      await page.getByText('Searching', { exact: false }).waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});

      const remindTomorrow = page.getByText('Remind tomorrow', { exact: true }).first();
      await remindTomorrow.waitFor({ timeout: 20_000 });
      await snap('05-search-results');

      const card = page.locator('div', { has: remindTomorrow }).first();
      await card.click({ position: { x: 20, y: 20 } });
      await page.getByText('Record', { exact: true }).waitFor({ timeout: 20_000 });
      await snap('06-record-details');
    });

    await step('reminder-settings', async () => {
      await ensureHome();
      await page.getByText('Reminder settings', { exact: true }).click();
      await page.getByText('Reminder Settings', { exact: true }).waitFor();
      await snap('07-reminder-settings');
      await page.getByText('Open history', { exact: true }).click();
      await page.getByText('Reminder History', { exact: true }).waitFor();
      await snap('08-reminder-history');
      await page.getByText('Back', { exact: true }).click();
      await page.getByText('Discover', { exact: true }).waitFor();
    });

    await step('account', async () => {
      await ensureHome();
      await page.getByText('Open account', { exact: true }).click();
      await page.getByText('Library account', { exact: true }).waitFor();
      await snap('09-account');
    });

    await browser.close();
    await context.close();

    await fs.writeFile(
      path.join(OUTPUT_DIR, 'qa-results.json'),
      JSON.stringify(results, null, 2) + '\n',
      'utf8',
    );

    console.log(`\nSaved QA artifacts to ${OUTPUT_DIR}`);
  } finally {
    if (!server.killed) server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), sleep(5_000)]).catch(() => {});
    if (!server.killed) server.kill('SIGKILL');
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
