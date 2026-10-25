import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';

function resolveValidatedTestDatabaseUrl(): string {
  let rawUrl = process.env.TEST_DATABASE_URL;

  if (!rawUrl || !rawUrl.trim()) {
    const configDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(configDir, '..', '.env.test'),
      path.resolve(process.cwd(), '..', '.env.test'),
      path.resolve(process.cwd(), '.env.test'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const content = fs.readFileSync(candidate, 'utf-8');
          for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (trimmed.startsWith('TEST_DATABASE_URL=')) {
              rawUrl = trimmed.slice('TEST_DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
              break;
            }
          }
        } catch {
          // Ignore read errors and continue
        }
      }
      if (rawUrl) break;
    }
  }

  if (!rawUrl || !rawUrl.trim()) {
    throw new Error(
      'FAIL-CLOSED: TEST_DATABASE_URL must be explicitly configured before starting Playwright.\n' +
      'Set TEST_DATABASE_URL in the environment (e.g. export TEST_DATABASE_URL=postgresql://careerbridge_test_runner:<password>@127.0.0.1:5435/internship_test_db) ' +
      'or provide it in .env.test. Executing tests against the development database is strictly prohibited.'
    );
  }

  const cleanUrl = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    throw new Error('FAIL-CLOSED: TEST_DATABASE_URL is malformed. Unable to parse test database URL.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('FAIL-CLOSED: TEST_DATABASE_URL must use the postgresql driver.');
  }

  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error('FAIL-CLOSED: TEST_DATABASE_URL must target an approved local host (localhost, 127.0.0.1, or ::1). Remote database hosts are not allowed.');
  }

  const dbName = parsed.pathname.replace(/^\//, '');
  if (dbName !== 'internship_test_db') {
    throw new Error("FAIL-CLOSED: TEST_DATABASE_URL must target 'internship_test_db'.");
  }

  return cleanUrl;
}

const validatedTestDatabaseUrl = resolveValidatedTestDatabaseUrl();
process.env.TEST_DATABASE_URL = validatedTestDatabaseUrl;
process.env.DATABASE_URL = validatedTestDatabaseUrl;

/**
 * CareerBridge Playwright End-to-End Test Configuration (Phase F-12)
 *
 * Configured for deterministic multi-role browser testing (Student, Recruiter, Admin).
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 45 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: [
    {
      command: 'python -m uvicorn app.main:app --host 127.0.0.1 --port 8000',
      cwd: '../backend',
      url: 'http://127.0.0.1:8000/health',
      reuseExistingServer: false,
      timeout: 30 * 1000,
      env: {
        CAREERBRIDGE_TEST_MODE: '1',
        DATABASE_URL: validatedTestDatabaseUrl,
        TEST_DATABASE_URL: validatedTestDatabaseUrl,
      },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
  ],
});
