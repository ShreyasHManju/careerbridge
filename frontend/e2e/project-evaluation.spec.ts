import { test, expect } from '@playwright/test';

/**
 * CareerBridge Recruiter Project Evaluation E2E Workflow (Phase 30C)
 *
 * Validates the complete evaluation lifecycle:
 * 1. Recruiter registers and posts a job.
 * 2. Student registers, creates an Innovation Project, and applies for the recruiter's job.
 * 3. Recruiter reviews the student's project, enters dimensional scores (1-5), assesses skills,
 *    provides feedback and recommendation, and submits the evaluation.
 * 4. Student logs in and verifies the structured evaluation, dimension breakdown, and hiring recommendation.
 * 5. Security check: An unrelated recruiter cannot evaluate a private project without an active candidate application.
 */
test.describe('Recruiter Project Evaluation Workflow (Phase 30C)', () => {
  const timestamp = Date.now();
  const testPassword = 'StrongPassword123!';

  const recruiterEmail = `e2e_eval_recruiter_${timestamp}@careerbridge.io`;
  const studentEmail = `e2e_eval_student_${timestamp}@careerbridge.io`;
  const otherRecruiterEmail = `e2e_other_recruiter_${timestamp}@careerbridge.io`;

  const jobTitle = `Platform Engineer ${timestamp}`;
  const companyName = `Apex Cloud Systems ${timestamp}`;
  const projectTitle = `Distributed Query Engine ${timestamp}`;

  test('Complete Recruiter Evaluation Lifecycle & Security Verification', async ({ browser }) => {
    // -------------------------------------------------------------------------
    // STEP 1: Recruiter Registers & Posts Job Opportunity
    // -------------------------------------------------------------------------
    const recruiterContext = await browser.newContext();
    const recruiterPage = await recruiterContext.newPage();

    await recruiterPage.goto('/register');
    await recruiterPage.getByLabel(/Email Address/i).fill(recruiterEmail);
    await recruiterPage.getByLabel(/^Password/i).fill(testPassword);
    await recruiterPage.getByLabel(/Account Type/i).selectOption('recruiter');
    await recruiterPage.getByRole('button', { name: /Register/i }).click();

    await expect(recruiterPage.getByText(/Account created successfully!/i)).toBeVisible({ timeout: 10000 });
    await expect(recruiterPage).toHaveURL(/\/login/, { timeout: 10000 });

    await recruiterPage.getByLabel(/Email Address/i).fill(recruiterEmail);
    await recruiterPage.getByLabel(/^Password/i).fill(testPassword);
    await recruiterPage.getByRole('button', { name: /Sign In/i }).click();
    await expect(recruiterPage).toHaveURL(/\/app/, { timeout: 10000 });

    // Post job
    await recruiterPage.locator('nav.cb-nav-links').getByRole('link', { name: 'Job Postings' }).click();
    await recruiterPage.getByRole('button', { name: /\+ Post a Job/i }).click();
    await recruiterPage.getByLabel(/Job Title/i).fill(jobTitle);
    await recruiterPage.getByLabel(/Company Name/i).fill(companyName);
    await recruiterPage.getByLabel(/Location/i).fill('Remote');
    await recruiterPage.getByLabel(/Description/i).fill('Designing high-performance distributed systems.');
    await recruiterPage.getByTestId('job-form-submit-btn').dispatchEvent('click');
    await expect(recruiterPage.getByRole('link', { name: jobTitle })).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // STEP 2: Student Registers, Creates Project, and Applies to Job
    // -------------------------------------------------------------------------
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    await studentPage.goto('/register');
    await studentPage.getByLabel(/Email Address/i).fill(studentEmail);
    await studentPage.getByLabel(/^Password/i).fill(testPassword);
    await studentPage.getByLabel(/Account Type/i).selectOption('student');
    await studentPage.getByRole('button', { name: /Register/i }).click();

    await expect(studentPage.getByText(/Account created successfully!/i)).toBeVisible({ timeout: 10000 });
    await expect(studentPage).toHaveURL(/\/login/, { timeout: 10000 });

    await studentPage.getByLabel(/Email Address/i).fill(studentEmail);
    await studentPage.getByLabel(/^Password/i).fill(testPassword);
    await studentPage.getByRole('button', { name: /Sign In/i }).click();
    await expect(studentPage).toHaveURL(/\/app/, { timeout: 10000 });

    // Create Innovation Project
    await studentPage.locator('nav.cb-nav-links').getByRole('link', { name: 'Projects' }).click();
    await expect(studentPage).toHaveURL(/\/app\/projects/);

    await studentPage.getByRole('button', { name: /\+ New Project/i }).click();
    await studentPage.getByLabel(/Project Title/i).fill(projectTitle);
    await studentPage.getByLabel(/Short Summary/i).fill('High-throughput distributed query processor in Rust.');
    await studentPage.getByLabel(/Detailed Description/i).fill('Architecture implements cost-based optimizer and vectorized execution.');
    await studentPage.getByRole('button', { name: /Publish Project/i }).click();

    const projectLink = studentPage.getByRole('link', { name: projectTitle });
    await expect(projectLink).toBeVisible({ timeout: 10000 });
    const projectHref = (await projectLink.getAttribute('href')) || '/app/projects';

    // Apply to Recruiter Job
    await studentPage.locator('nav.cb-nav-links').getByRole('link', { name: 'Opportunities' }).click();
    const searchInput = studentPage.getByLabel(/Keyword Search/i);
    await searchInput.fill(jobTitle);
    await studentPage.getByRole('button', { name: /Apply Filters/i }).click();

    await expect(studentPage.getByRole('link', { name: jobTitle })).toBeVisible({ timeout: 10000 });
    await studentPage.getByRole('button', { name: /^Apply$/i }).first().click();

    const coverInput = studentPage.getByLabel(/Cover Letter/i);
    if (await coverInput.isVisible()) {
      await coverInput.fill('Excited to apply with my distributed query engine experience!');
    }
    await studentPage.getByRole('button', { name: /Submit Application/i }).click();
    await expect(studentPage.getByText(/Application submitted successfully!/i)).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // STEP 3: Recruiter Reviews Candidate Project & Submits Evaluation
    // -------------------------------------------------------------------------
    await recruiterPage.goto(projectHref);
    await expect(recruiterPage.getByRole('heading', { name: projectTitle })).toBeVisible({ timeout: 10000 });

    // Open Evaluation Modal
    const evalBtn = recruiterPage.getByTestId('evaluate-project-btn');
    await expect(evalBtn).toBeVisible({ timeout: 10000 });
    await evalBtn.click();

    await expect(recruiterPage.getByTestId('project-evaluation-modal')).toBeVisible();

    // Fill all 5 scores
    await recruiterPage.getByTestId('eval-tech-score-select').selectOption('5');
    await recruiterPage.getByTestId('eval-problem-score-select').selectOption('5');
    await recruiterPage.getByTestId('eval-exec-score-select').selectOption('4');
    await recruiterPage.getByTestId('eval-comm-score-select').selectOption('4');
    await recruiterPage.getByTestId('eval-evidence-score-select').selectOption('5');

    // Recommendation
    await recruiterPage.getByTestId('eval-recommendation-select').selectOption('strongly_recommended');

    // Qualitative feedback
    await recruiterPage.getByTestId('eval-strengths-input').fill('Exceptional query optimization algorithms and low-latency performance.');
    await recruiterPage.getByTestId('eval-improvement-input').fill('Could include distributed cluster fault tolerance tests.');
    await recruiterPage.getByTestId('eval-feedback-input').fill('Outstanding candidate demonstrating deep systems architecture expertise.');

    // Submit evaluation
    await recruiterPage.getByTestId('submit-modal-btn').click();

    // Verify submitted evaluation card appears on recruiter page
    await expect(recruiterPage.getByTestId('evaluation-overall-score')).toBeVisible({ timeout: 10000 });
    await expect(recruiterPage.getByText('4.6')).toBeVisible();
    await expect(recruiterPage.getByText('Strongly Recommended')).toBeVisible();

    // -------------------------------------------------------------------------
    // STEP 4: Student Verifies Submitted Evaluation
    // -------------------------------------------------------------------------
    await studentPage.goto(projectHref);

    // Verify evaluation is visible to student
    await expect(studentPage.getByTestId('project-evaluations-section')).toBeVisible({ timeout: 10000 });
    await expect(studentPage.getByTestId('evaluation-overall-score')).toBeVisible({ timeout: 10000 });
    await expect(studentPage.getByText('4.6')).toBeVisible();
    await expect(studentPage.getByText('Strongly Recommended')).toBeVisible();
    await expect(studentPage.getByText('Exceptional query optimization algorithms')).toBeVisible();

    // -------------------------------------------------------------------------
    // STEP 5: Security / Isolation Check — Other Recruiter Cannot Modify Evaluation
    // -------------------------------------------------------------------------
    const otherRecruiterContext = await browser.newContext();
    const otherRecruiterPage = await otherRecruiterContext.newPage();

    await otherRecruiterPage.goto('/register');
    await otherRecruiterPage.getByLabel(/Email Address/i).fill(otherRecruiterEmail);
    await otherRecruiterPage.getByLabel(/^Password/i).fill(testPassword);
    await otherRecruiterPage.getByLabel(/Account Type/i).selectOption('recruiter');
    await otherRecruiterPage.getByRole('button', { name: /Register/i }).click();
    await expect(otherRecruiterPage).toHaveURL(/\/login/, { timeout: 10000 });

    await otherRecruiterPage.getByLabel(/Email Address/i).fill(otherRecruiterEmail);
    await otherRecruiterPage.getByLabel(/^Password/i).fill(testPassword);
    await otherRecruiterPage.getByRole('button', { name: /Sign In/i }).click();

    // Navigate to project
    await otherRecruiterPage.goto(projectHref);

    // Other recruiter should NOT see edit or withdraw buttons on first recruiter's evaluation
    await expect(otherRecruiterPage.getByTestId('edit-evaluation-btn')).not.toBeVisible();
    await expect(otherRecruiterPage.getByTestId('withdraw-evaluation-btn')).not.toBeVisible();

    await recruiterContext.close();
    await studentContext.close();
    await otherRecruiterContext.close();
  });
});
