import { test, expect } from '@playwright/test';

/**
 * CareerBridge Multi-Role Student & Recruiter E2E Workflow (Phase F-12)
 *
 * Validates the core cross-role business journey in isolated browser contexts:
 * 1. Recruiter registers, logs in, and posts a new job opportunity.
 * 2. Student registers, logs in, discovers the opportunity, and submits an application.
 * 3. Recruiter reviews the student's incoming application and advances status to "Accepted".
 * 4. Student verifies the updated "Accepted" status reflected in their application tracker.
 */
test.describe('Student & Recruiter Application Lifecycle', () => {
  const timestamp = Date.now();
  const testPassword = 'StrongPassword123!';

  const recruiterEmail = `e2e_recruiter_${timestamp}@careerbridge.io`;
  const studentEmail = `e2e_student_${timestamp}@careerbridge.io`;

  const jobTitle = `AI Software Engineer ${timestamp}`;
  const companyName = `Apex Labs ${timestamp}`;

  test('Complete End-to-End Application & Status Transition Flow', async ({ browser }) => {
    // -------------------------------------------------------------------------
    // STEP 1: Recruiter Context — Register & Post Job
    // -------------------------------------------------------------------------
    const recruiterContext = await browser.newContext();
    const recruiterPage = await recruiterContext.newPage();

    // 1.1 Register recruiter
    await recruiterPage.goto('/register');
    await recruiterPage.getByLabel(/Email Address/i).fill(recruiterEmail);
    await recruiterPage.getByLabel(/^Password/i).fill(testPassword);
    await recruiterPage.getByLabel(/Account Type/i).selectOption('recruiter');
    await recruiterPage.getByRole('button', { name: /Register/i }).click();

    await expect(recruiterPage.getByText(/Account created successfully!/i)).toBeVisible({ timeout: 10000 });
    await expect(recruiterPage).toHaveURL(/\/login/, { timeout: 10000 });

    // 1.2 Login recruiter
    await recruiterPage.getByLabel(/Email Address/i).fill(recruiterEmail);
    await recruiterPage.getByLabel(/^Password/i).fill(testPassword);
    await recruiterPage.getByRole('button', { name: /Sign In/i }).click();
    await expect(recruiterPage).toHaveURL(/\/app/, { timeout: 10000 });

    // 1.3 Navigate to Recruiter Job Postings and Post Opportunity
    await recruiterPage.locator('nav.cb-nav-links').getByRole('link', { name: 'Job Postings' }).click();
    await expect(recruiterPage).toHaveURL(/\/app\/recruiter\/jobs/);

    await recruiterPage.getByRole('button', { name: /\+ Post a Job/i }).click();
    await expect(recruiterPage.getByRole('heading', { name: /Create New Job Posting/i })).toBeVisible();

    await recruiterPage.getByLabel(/Job Title/i).fill(jobTitle);
    await recruiterPage.getByLabel(/Company Name/i).fill(companyName);
    await recruiterPage.getByLabel(/Location/i).fill('San Francisco, CA');
    await recruiterPage.getByLabel(/Description/i).fill('Building resilient full-stack systems with React and FastAPI.');

    await recruiterPage.getByTestId('job-form-submit-btn').dispatchEvent('click');

    // Verify posting appears in recruiter's job list
    await expect(recruiterPage.getByRole('link', { name: jobTitle })).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // STEP 2: Student Context — Register, Discover Opportunity & Apply
    // -------------------------------------------------------------------------
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    // 2.1 Register student
    await studentPage.goto('/register');
    await studentPage.getByLabel(/Email Address/i).fill(studentEmail);
    await studentPage.getByLabel(/^Password/i).fill(testPassword);
    await studentPage.getByLabel(/Account Type/i).selectOption('student');
    await studentPage.getByRole('button', { name: /Register/i }).click();

    await expect(studentPage.getByText(/Account created successfully!/i)).toBeVisible({ timeout: 10000 });
    await expect(studentPage).toHaveURL(/\/login/, { timeout: 10000 });

    // 2.2 Login student
    await studentPage.getByLabel(/Email Address/i).fill(studentEmail);
    await studentPage.getByLabel(/^Password/i).fill(testPassword);
    await studentPage.getByRole('button', { name: /Sign In/i }).click();
    await expect(studentPage).toHaveURL(/\/app/, { timeout: 10000 });

    // 2.3 Discover Job and Submit Application
    await studentPage.locator('nav.cb-nav-links').getByRole('link', { name: 'Opportunities' }).click();
    await expect(studentPage).toHaveURL(/\/app\/jobs/);

    // Search or locate the newly created job
    const searchInput = studentPage.getByLabel(/Keyword Search/i);
    await searchInput.fill(jobTitle);
    await studentPage.getByRole('button', { name: /Apply Filters/i }).click();

    await expect(studentPage.getByRole('link', { name: jobTitle })).toBeVisible({ timeout: 10000 });
    await expect(studentPage.getByText(companyName).first()).toBeVisible();

    // Click Apply button on the specific job card
    await studentPage.getByRole('button', { name: /^Apply$/i }).first().click();

    // Fill cover message in modal and submit
    await expect(studentPage.getByRole('heading', { name: new RegExp(`Apply for ${jobTitle}`, 'i') })).toBeVisible();
    await studentPage.getByLabel(/Cover Note \/ Message/i).fill('Automated E2E student application statement.');
    await studentPage.getByRole('button', { name: /Submit Application/i }).click();

    // Verify submission feedback
    await expect(studentPage.getByText(/Application Submitted!/i)).toBeVisible({ timeout: 10000 });

    // 2.4 Verify application appears in Student Applications tracker
    await studentPage.locator('nav.cb-nav-links').getByRole('link', { name: 'My Applications' }).click();
    await expect(studentPage).toHaveURL(/\/app\/applications/);
    await expect(studentPage.getByText(jobTitle).first()).toBeVisible({ timeout: 10000 });
    await expect(studentPage.getByRole('status', { name: /Application status: Applied/i })).toBeVisible();

    // -------------------------------------------------------------------------
    // STEP 3: Recruiter Context — Review Application & Update Status to Accepted
    // -------------------------------------------------------------------------
    await recruiterPage.locator('nav.cb-nav-links').getByRole('link', { name: 'Applications' }).click();
    await expect(recruiterPage).toHaveURL(/\/app\/recruiter\/applications/);

    await expect(recruiterPage.getByText(jobTitle).first()).toBeVisible({ timeout: 10000 });
    await expect(recruiterPage.getByText('Automated E2E student application statement.')).toBeVisible();

    // Transition status to "Accepted"
    const statusSelect = recruiterPage.getByRole('combobox', { name: /Change status for Application/i });
    await statusSelect.selectOption('accepted');

    // Verify status updated in recruiter view
    await expect(recruiterPage.getByRole('status', { name: /Application status: Accepted/i })).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // STEP 4: Student Context — Verify Updated Status Reflection
    // -------------------------------------------------------------------------
    await studentPage.reload();
    await expect(studentPage.getByText(jobTitle).first()).toBeVisible({ timeout: 10000 });
    await expect(studentPage.getByRole('status', { name: /Application status: Accepted/i })).toBeVisible({ timeout: 10000 });

    // Clean up isolated contexts
    await studentContext.close();
    await recruiterContext.close();
  });
});
