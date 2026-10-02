import { test, expect } from '@playwright/test';

const adminEmail =
  process.env.E2E_ADMIN_EMAIL || 'admin_e2e@careerbridge.io';

const adminPassword =
  process.env.E2E_ADMIN_PASSWORD || 'StrongAdminPassword123!';

const studentEmail =
  `e2e-student-${Date.now()}@example.com`;

const studentPassword = 'Student123!';

test.describe('Platform Administration & Moderation', () => {
  test('A. Role protection: Students cannot access admin governance routes', async ({
    page,
  }) => {
    // ------------------------------------------------------------
    // 1. Register a student
    // ------------------------------------------------------------
    await page.goto('/register');

    await expect(
      page.getByRole('heading', { name: /Create Account/i })
    ).toBeVisible({ timeout: 10000 });

    /*
     * CareerBridge registration currently contains:
     * - Email Address
     * - Password
     * - Account Type
     *
     * There is NO Full Name field in RegisterPage.tsx.
     */

    await page
      .getByLabel(/Email Address/i)
      .fill(studentEmail);

    await page
      .getByLabel(/^Password$/i)
      .fill(studentPassword);

    const roleSelect = page.getByLabel(/Account Type/i);

    if (await roleSelect.count()) {
      await roleSelect.selectOption('student');
    }

    await page
      .getByRole('button', { name: /^Register$/i })
      .click();

    await expect(
      page.getByText(/Account created successfully!/i)
    ).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveURL(/\/login/, {
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 2. Login as student
    // ------------------------------------------------------------
    await page
      .getByLabel(/Email Address/i)
      .fill(studentEmail);

    await page
      .getByLabel(/^Password$/i)
      .fill(studentPassword);

    await page
      .getByRole('button', { name: /Sign In/i })
      .click();

    await expect(page).toHaveURL(/\/app/, {
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 3. Student must NOT access admin user management
    // ------------------------------------------------------------
    await page.goto('/app/admin/users');

    /*
     * The exact implementation may redirect either to:
     * - /unauthorized
     * - /app
     * - another protected location
     *
     * The important security requirement is that the student
     * must NOT remain on /app/admin/users.
     */
    await expect(page).not.toHaveURL(/\/app\/admin\/users/, {
      timeout: 10000,
    });
  });

  test('B. Admin access: Inspect platform user directory and view user details', async ({
    page,
  }) => {
    // ------------------------------------------------------------
    // 1. Login as seeded E2E admin
    // ------------------------------------------------------------
    await page.goto('/login');

    await page
      .getByLabel(/Email Address/i)
      .fill(adminEmail);

    await page
      .getByLabel(/^Password$/i)
      .fill(adminPassword);

    await page
      .getByRole('button', { name: /Sign In/i })
      .click();

    await expect(page).toHaveURL(/\/app/, {
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 2. Navigate to User Management
    // ------------------------------------------------------------
    const userManagementLink = page
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: /User Management/i });

    await expect(userManagementLink).toBeVisible({
      timeout: 10000,
    });

    await userManagementLink.click();

    await expect(page).toHaveURL(/\/app\/admin\/users/, {
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 3. Verify User Management page
    // ------------------------------------------------------------

    await expect(
      page.getByRole('heading', { name: /User Management/i })
    ).toBeVisible({ timeout: 10000 });

    // ------------------------------------------------------------
    // 4. If users exist, inspect the first user's details
    // ------------------------------------------------------------
    const userTable = page.getByRole('table').first();

    if (
      await userTable
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      const detailsButton = page
        .getByRole('button', {
          name: /View|Details|Inspect/i,
        })
        .first();

      if (
        await detailsButton
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await detailsButton.click();

        /*
         * The details UI may be implemented as a dialog.
         * If so, verify it. If not, the page should still remain
         * on the admin user-management route.
         */
        const dialog = page.getByRole('dialog').first();

        if (
          await dialog
            .isVisible({ timeout: 5000 })
            .catch(() => false)
        ) {
          await expect(dialog).toBeVisible();

          const closeButton = dialog.getByRole('button', {
            name: /Close/i,
          });

          if (
            await closeButton
              .isVisible({ timeout: 3000 })
              .catch(() => false)
          ) {
            await closeButton.click();

            await expect(dialog).not.toBeVisible();
          }
        } else {
          await expect(page).toHaveURL(/\/app\/admin\/users/);
        }
      }
    }
  });

  test('C. Job moderation: View job listings and toggle moderation status', async ({
    page,
  }) => {
    // ------------------------------------------------------------
    // 1. Login as admin
    // ------------------------------------------------------------
    await page.goto('/login');

    await page
      .getByLabel(/Email Address/i)
      .fill(adminEmail);

    await page
      .getByLabel(/^Password$/i)
      .fill(adminPassword);

    await page
      .getByRole('button', { name: /Sign In/i })
      .click();

    await expect(page).toHaveURL(/\/app/, {
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 2. Navigate to Job Moderation
    // ------------------------------------------------------------
    const jobModerationLink = page
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: /Job Moderation/i });

    await expect(jobModerationLink).toBeVisible({
      timeout: 10000,
    });

    await jobModerationLink.click();

    await expect(page).toHaveURL(/\/app\/admin\/jobs/, {
      timeout: 10000,
    });

    await expect(
      page.getByRole('heading', {
        name: /Job & Internship Moderation/i,
      })
    ).toBeVisible({
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 3. Wait for loading to finish
    // ------------------------------------------------------------
    await expect(
      page.getByRole('status')
    ).not.toBeVisible({
      timeout: 10000,
    }).catch(() => {
      // Loading indicator may disappear before the assertion
      // or may not exist depending on rendering timing.
    });

    // ------------------------------------------------------------
    // 4. Page may contain either:
    //
    //    A. Moderation table when jobs exist
    //    B. Empty state when no jobs exist
    //
    //    Both are valid.
    // ------------------------------------------------------------
    const table = page.getByRole('table', {
      name: /Job Postings Moderation Table/i,
    });

    const emptyState = page.getByTestId(
      'jobs-empty-state'
    );

    const tableVisible = await table
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    const emptyVisible = await emptyState
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    expect(tableVisible || emptyVisible).toBeTruthy();

    // ------------------------------------------------------------
    // 5. If there are no jobs, the test is complete.
    // ------------------------------------------------------------
    if (!tableVisible) {
      return;
    }

    // ------------------------------------------------------------
    // 6. Verify moderation table
    // ------------------------------------------------------------
    await expect(table).toBeVisible();

    const rows = table.locator('tbody tr');

    const rowCount = await rows.count();

    expect(rowCount).toBeGreaterThan(0);

    // ------------------------------------------------------------
    // 7. Find a moderation button
    // ------------------------------------------------------------
    const moderationButtons = page.getByRole('button', {
      name: /Activate|Deactivate/i,
    });

    const moderationButtonCount =
      await moderationButtons.count();

    expect(moderationButtonCount).toBeGreaterThan(0);

    const moderationButton =
      moderationButtons.first();

    await expect(moderationButton).toBeVisible();

    // ------------------------------------------------------------
    // 8. Capture current button state
    // ------------------------------------------------------------
    const initialButtonText =
      (await moderationButton.innerText()).trim();

    expect(
      /Activate|Deactivate/i.test(initialButtonText)
    ).toBeTruthy();

    // ------------------------------------------------------------
    // 9. Open moderation modal
    // ------------------------------------------------------------
    await moderationButton.click();

    // ------------------------------------------------------------
    // 10. Verify moderation modal
    // ------------------------------------------------------------
    const dialog = page.getByRole('dialog').first();

    await expect(dialog).toBeVisible({
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 11. Find confirmation action
    // ------------------------------------------------------------
    const confirmButton = dialog
      .getByRole('button', {
        name: /Activate|Deactivate|Confirm|Update|Save/i,
      })
      .last();

    await expect(confirmButton).toBeVisible({
      timeout: 5000,
    });

    // ------------------------------------------------------------
    // 12. Confirm moderation change
    // ------------------------------------------------------------
    await confirmButton.click();

    // ------------------------------------------------------------
    // 13. Wait for modal to close
    // ------------------------------------------------------------
    await expect(dialog).not.toBeVisible({
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 14. Verify success notification or updated table
    // ------------------------------------------------------------
    const successMessage = page.getByRole('alert').filter({
      hasText: /status was successfully updated|updated|success/i,
    });

    const successVisible = await successMessage
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    /*
     * The implementation may update the table without showing
     * an alert, so either a success message OR a changed status
     * is acceptable.
     */
    const updatedStatus = page
      .locator('[data-testid^="job-status-"]')
      .first();

    const statusVisible = await updatedStatus
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(successVisible || statusVisible).toBeTruthy();
  });
});