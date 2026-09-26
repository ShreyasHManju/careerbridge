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

  try {
    execSync(`"${pythonPath}" "${cleanupScript}"`, {
      cwd: backendDir,
      stdio: 'pipe',
    });
  } catch {
    // If backend python is unavailable or teardown encounters an issue, do not crash Playwright
  }
}
