import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Global Teardown for CareerBridge Playwright Tests
 * Cleans up transient test records created during E2E runs to maintain DB hygiene.
 */
export default async function globalTeardown() {
  const backendDir = path.resolve(process.cwd(), '../backend');
  const cleanupScript = path.resolve(process.cwd(), 'e2e/cleanup_e2e_db.py');
  const localVenvPython = process.platform === 'win32'
    ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDir, '.venv', 'bin', 'python');

  const pythonPath = fs.existsSync(localVenvPython)
    ? localVenvPython
    : 'python';

  const env = {
    ...process.env,
    CAREERBRIDGE_TEST_MODE: '1',
    DATABASE_URL: process.env.TEST_DATABASE_URL || '',
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || '',
  };

  try {
    const output = execSync(`"${pythonPath}" "${cleanupScript}"`, {
      cwd: backendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    if (output) {
      console.log(`[E2E-TEARDOWN] ${output.trim()}`);
    }
  } catch (error: any) {
    const stderr = error.stderr ? error.stderr.toString() : '';
    const stdout = error.stdout ? error.stdout.toString() : '';
    console.error(`[E2E-TEARDOWN ERROR] Global teardown cleanup failed: ${error.message}`);
    if (stdout) console.error(`[E2E-TEARDOWN STDOUT]:\n${stdout}`);
    if (stderr) console.error(`[E2E-TEARDOWN STDERR]:\n${stderr}`);
    throw new Error(`E2E Global Teardown failed during cleanup: ${error.message}`);
  }
}
