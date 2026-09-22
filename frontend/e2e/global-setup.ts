import { execSync } from 'child_process';
import path from 'path';

/**
 * CareerBridge Playwright Global Setup
 *
 * Ensures deterministic test preconditions (e.g. test admin account) are seeded
 * in the local backend database before E2E tests run.
 */
export default async function globalSetup() {
  try {
    const backendDir = path.resolve(process.cwd(), '../backend');
    const pythonExe = process.platform === 'win32'
      ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
      : path.join(backendDir, '.venv', 'bin', 'python');

    const seedScript = "from app.core.database import SessionLocal; from app.models.user import User, UserRole; from app.core.security import hash_password; db = SessionLocal(); admin = db.query(User).filter(User.email == 'admin_e2e@careerbridge.io').first(); (not admin) and (db.add(User(email='admin_e2e@careerbridge.io', password_hash=hash_password('StrongAdminPassword123!'), role=UserRole.ADMIN, is_active=True, is_verified=True)) or db.commit()); db.close()";

    execSync(`"${pythonExe}" -c "${seedScript}"`, {
      cwd: backendDir,
      stdio: 'pipe',
    });
  } catch (err) {
    // If backend virtualenv is not directly accessible, degrade gracefully
    console.warn('[E2E Global Setup] Note: DB auto-seed skipped or completed:', err instanceof Error ? err.message : String(err));
  }
}
