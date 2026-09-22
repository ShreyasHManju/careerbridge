import { test, expect } from '@playwright/test';

/**
 * CareerBridge E2E Authentication Test Suite (Phase F-12)
 *
 * Validates real browser registration, login, session persistence across page reloads,
 * logout, invalid credential error handling, and PWA manifest presence.
 */
test.describe.serial('Authentication & Session Management', () => {
  const timestamp = Date.now();
  const testStudentEmail = `e2e_student_${timestamp}@careerbridge.io`;
  const testPassword = 'StrongPassword123!';

  test('A. Student registration via UI', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByRole('heading', { name: /Create Account/i })).toBeVisible();

    await page.getByLabel(/Email Address/i).fill(testStudentEmail);
    await page.getByLabel(/^Password/i).fill(testPassword);
    await page.getByLabel(/Account Type/i).selectOption('student');

    await page.getByRole('button', { name: /Register/i }).click();

    // Verify success notice
    await expect(
      page.getByText(/Account created successfully!/i)
    ).toBeVisible({ timeout: 10000 });

    // Expect automated redirect to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('B. Student login and session persistence across page reloads', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible();

    await page.getByLabel(/Email Address/i).fill(testStudentEmail);
    await page.getByLabel(/^Password/i).fill(testPassword);

    await page.getByRole('button', { name: /Sign In/i }).click();

    // Verify navigation to authenticated /app dashboard
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible();
    await expect(page.getByText(testStudentEmail)).toBeVisible();

    // Navigate to another protected route via navbar
    await page.locator('nav.cb-nav-links').getByRole('link', { name: 'Opportunities' }).click();
    await expect(page).toHaveURL(/\/app\/jobs/);

    // Reload page and verify session persistence
    await page.reload();
    await expect(page).toHaveURL(/\/app\/jobs/);
    await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible();
    await expect(page.getByText(testStudentEmail)).toBeVisible();
  });

  test('C. User logout', async ({ page }) => {
    // Log in first
    await page.goto('/login');
    await page.getByLabel(/Email Address/i).fill(testStudentEmail);
    await page.getByLabel(/^Password/i).fill(testPassword);
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });

    // Click Sign Out
    await page.getByRole('button', { name: /Sign Out/i }).click();

    // Verify redirect to /login and unauthenticated state
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('D. Display error alert on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/Email Address/i).fill(testStudentEmail);
    await page.getByLabel(/^Password/i).fill('CompletelyWrongPassword999!');

    await page.getByRole('button', { name: /Sign In/i }).click();

    // Verify error alert
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('E. PWA web manifest metadata check', async ({ page }) => {
    await page.goto('/login');

    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.webmanifest');
  });
});
