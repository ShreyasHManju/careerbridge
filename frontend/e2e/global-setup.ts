import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * CareerBridge Playwright Global Setup
 *
 * Ensures deterministic test preconditions (e.g. test admin account) are seeded
 * in the backend database before E2E tests run.
 */
export default async function globalSetup() {
  try {
    const backendDir = path.resolve(process.cwd(), '../backend');

    const localVenvPython = process.platform === 'win32'
      ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
      : path.join(backendDir, '.venv', 'bin', 'python');

    const pythonExe = fs.existsSync(localVenvPython)
      ? localVenvPython
      : 'python';

    const seedScript = `
from app.core.test_database import (
    validate_test_database_url,
    verify_test_database_identity,
    get_test_engine,
    get_test_sessionmaker,
)
from sqlalchemy import text
from app.models.user import User, UserRole
from app.core.security import hash_password

# 1. Validate test database URL & approved host
validate_test_database_url()

# 2. Verify live identity and least-privilege role
eng = get_test_engine()
identity = verify_test_database_identity(eng)
if identity["database"] != "internship_test_db":
    raise RuntimeError(f"FAIL-CLOSED: Expected database 'internship_test_db', got '{identity['database']}'")
if identity["user"] != "careerbridge_test_runner":
    raise RuntimeError(f"FAIL-CLOSED: Expected role 'careerbridge_test_runner', got '{identity['user']}'")
if identity["is_superuser"]:
    raise RuntimeError("FAIL-CLOSED: Connected role has superuser privileges")

# 3. Verify Alembic migration revision
with eng.connect() as conn:
    rev = conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
    if rev != "b8c9d0e1f2a3":
        raise RuntimeError(f"FAIL-CLOSED: Expected migration revision 'b8c9d0e1f2a3', got '{rev}'")

# 4. Seed admin user using verified test session factory
SessionLocal = get_test_sessionmaker()
with SessionLocal() as db:
    admin = db.query(User).filter(
        User.email == 'admin_e2e@careerbridge.io'
    ).first()

    if not admin:
        db.add(
            User(
                email='admin_e2e@careerbridge.io',
                password_hash=hash_password('StrongAdminPassword123!'),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
        )
        db.commit()
`;

    execFileSync(pythonExe, ['-c', seedScript], {
      cwd: backendDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        CAREERBRIDGE_TEST_MODE: '1',
      },
    });
  } catch (err: any) {
    const stderrMsg = err?.stderr ? err.stderr.toString() : (err instanceof Error ? err.message : String(err));
    console.error('[E2E Global Setup] FATAL: Database verification or seed failed:\n', stderrMsg);
    throw new Error(`[E2E Global Setup] Aborting E2E run due to database validation failure: ${stderrMsg}`);
  }
}
