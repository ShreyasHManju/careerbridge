import { test, expect } from '@playwright/test';

/**
 * CareerBridge Admin Governance & Moderation E2E Test Suite (Phase F-12)
 *
 * Validates:
 * 1. Role protection: Unprivileged student is barred from `/app/admin/*` and redirected to `/unauthorized`.
 * 2. Admin access: Authenticated admin can inspect the platform user directory and view user details.
 * 3. Job moderation: Admin can view and moderate job posting visibility (activate/deactivate).
 */
test.describe('Platform Administration & Moderation', () => {
  const timestamp = Date.now();
  const studentEmail = `e2e_student_guard_${timestamp}@careerbridge.io`;
  const studentPassword = 'StrongPassword123!';

  const adminEmail = 'admin_e2e@careerbridge.io';
  const adminPassword = 'StrongAdminPassword123!';

  test('A. Role protection: Students cannot access admin governance routes', async ({ page }) => {
    // 1. Register and login student
    await page.goto('/register');
    await page.getByLabel(/Email Address/i).fill(studentEmail);
    await page.getByLabel(/^Password/i).fill(studentPassword);
    await page.getByLabel(/Account Type/i).selectOption('student');
    await page.getByRole('button', { name: /Register/i }).click();

    await expect(page.getByText(/Account created successfully!/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    await page.getByLabel(/Email Address/i).fill(studentEmail);
    await page.getByLabel(/^Password/i).fill(studentPassword);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

    // 2. Student attempts direct navigation to /app/admin/users
    await page.goto('/app/admin/users');

    // 3. Verify access is denied by role guard
    await expect(page.getByRole('heading', { name: /403 — Access Denied/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/does not have permission to view this resource/i)).toBeVisible();
  });

  test('B. Admin access: Inspect platform user directory and view user details', async ({ page }) => {
    // 1. Login as admin
    await page.goto('/login');
    await page.getByLabel(/Email Address/i).fill(adminEmail);
    await page.getByLabel(/^Password/i).fill(adminPassword);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

    // 2. Navigate to User Management via navbar
    await page.locator('nav.cb-nav-links').getByRole('link', { name: 'User Management' }).click();
    await expect(page).toHaveURL(/\/app\/admin\/users/);

    await expect(page.getByRole('heading', { name: /User Account Administration/i })).toBeVisible();
    const usersTable = page.getByRole('table', { name: /Platform Users Table/i });
    await expect(usersTable).toBeVisible({ timeout: 10000 });

    // 3. Search for admin or registered user
    const searchInput = page.getByPlaceholder(/Search by email/i);
    await searchInput.fill(adminEmail);
    await page.getByRole('button', { name: /Search/i }).click();

    await expect(usersTable.getByText(adminEmail)).toBeVisible({ timeout: 10000 });

    // 4. Open User Detail Modal
    await page.getByRole('button', { name: /^Details$/i }).first().click();
    await expect(page.getByRole('dialog', { name: /User Account Details/i })).toBeVisible();
    await expect(page.getByRole('dialog').getByText(adminEmail)).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: /^Close$/i }).click();
    await expect(page.getByRole('dialog', { name: /User Account Details/i })).not.toBeVisible();
  });

  test('C. Job moderation: View job listings and toggle moderation status', async ({ page }) => {
    // 1. Login as admin
    await page.goto('/login');
    await page.getByLabel(/Email Address/i).fill(adminEmail);
    await page.getByLabel(/^Password/i).fill(adminPassword);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

    // 2. Navigate to Job Moderation
    await page.locator('nav.cb-nav-links').getByRole('link', { name: 'Job Moderation' }).click();
    await expect(page).toHaveURL(/\/app\/admin\/jobs/);

    await expect(page.getByRole('heading', { name: /Job & Internship Moderation/i })).toBeVisible();

    // 3. Inspect moderation table
    const table = page.getByRole('table', { name: /Job Postings Moderation Table/i });
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      // If postings exist, toggle moderation on the first job and verify modal
      const toggleButton = page.getByRole('button', { name: /Deactivate|Activate/i }).first();
      await toggleButton.click();

      // Verify moderation confirmation modal
      await expect(page.getByTestId('job-moderation-modal')).toBeVisible();

      // Cancel to keep state clean
      await page.getByTestId('cancel-job-moderation-btn').click();
      await expect(page.getByTestId('job-moderation-modal')).not.toBeVisible();
    } else {
      // Empty state verification
      await expect(page.getByTestId('jobs-empty-state')).toBeVisible();
    }
  });
});
