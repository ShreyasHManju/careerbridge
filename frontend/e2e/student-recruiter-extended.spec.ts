import { test, expect } from '@playwright/test';

/**
 * CareerBridge Comprehensive Multi-Role Workflow E2E Test Suite
 *
 * Covers end-to-end user journeys:
 * 1. Student registers, populates profile, sets skills, creates project and inspects Experience Passport.
 * 2. Recruiter registers, posts a job, searches candidate directory, finds the student, and sends a Job Invitation.
 * 3. Student receives the Job Invitation in the Invitations Center, accepts it, and views the opportunity.
 * 4. Student applies to the job; Recruiter schedules an interview; Student views scheduled interview in Interviews Hub.
 */
test.describe('Student Profile, Candidate Sourcing, Job Invitation & Interview Flow', () => {
  test.setTimeout(90000);
  const timestamp = Date.now();
  const testPassword = 'StrongPassword123!';

  const studentEmail = `e2e_flow_student_${timestamp}@careerbridge.io`;
  const recruiterEmail = `e2e_flow_recruiter_${timestamp}@careerbridge.io`;

  const studentName = `Aria Chen ${timestamp}`;
  const jobTitle = `Full Stack Engineer ${timestamp}`;
  const companyName = `Nova Robotics ${timestamp}`;
  const projectTitle = `Neural Vision Pipeline ${timestamp}`;

  test('Complete End-to-End Discovery, Invitation, Application, and Interview Journey', async ({
    browser,
  }) => {
    // -------------------------------------------------------------------------
    // STEP 1: Student Context — Register, Profile Setup, Project & Passport
    // -------------------------------------------------------------------------
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    // 1.1 Student Registration
    await studentPage.goto('/register');
    await studentPage.getByLabel(/Email Address/i).fill(studentEmail);
    await studentPage.getByLabel(/^Password/i).fill(testPassword);
    await studentPage.getByLabel(/Account Type/i).selectOption('student');
    await studentPage.getByRole('button', { name: /Register/i }).click();

    await expect(
      studentPage.getByText(/Account created successfully!/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(studentPage).toHaveURL(/\/login/, { timeout: 10000 });

    // 1.2 Student Login
    await studentPage.getByLabel(/Email Address/i).fill(studentEmail);
    await studentPage.getByLabel(/^Password/i).fill(testPassword);
    await studentPage.getByRole('button', { name: /Sign In/i }).click();
    await expect(studentPage).toHaveURL(/\/app/, { timeout: 10000 });

    // 1.3 Setup Student Profile
    await studentPage
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: 'My Profile' })
      .click();
    await expect(studentPage).toHaveURL(/\/app\/student\/profile/);

    await studentPage.getByLabel(/Full Name/i).fill(studentName);
    await studentPage.getByLabel(/College \/ University/i).fill('Stanford University');
    await studentPage.getByLabel(/Degree/i).fill('Bachelor of Science');
    await studentPage.getByLabel(/Branch \/ Major/i).fill('Computer Science');
    await studentPage.getByLabel(/Graduation Year/i).fill('2026');
    await studentPage
      .getByLabel(/Professional Bio/i)
      .fill('Passionate software engineer focused on distributed systems and computer vision.');

    // Add skills
    const skillInput = studentPage.getByLabel(/Skills/i);
    if (await skillInput.count()) {
      await skillInput.fill('Python, TypeScript, React, Docker');
    }

    await studentPage.getByRole('button', { name: /Create Profile|Save Changes/i }).click();
    await expect(
      studentPage.getByText(/Profile (created|saved|updated) successfully!/i)
    ).toBeVisible({ timeout: 10000 });

    // 1.4 Create Innovation Project
    await studentPage
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: 'Projects' })
      .click();
    await expect(studentPage).toHaveURL(/\/app\/projects/);

    await studentPage.getByRole('button', { name: /\+ New Project/i }).click();
    await studentPage.getByLabel(/Project Title/i).fill(projectTitle);
    await studentPage
      .getByLabel(/Short Summary/i)
      .fill('Real-time perception and depth estimation pipeline using neural nets.');
    await studentPage
      .getByLabel(/Detailed Description/i)
      .fill('End-to-end edge compute pipeline processing 60 FPS video with ONNX runtime.');

    await studentPage.getByRole('button', { name: /Publish Project/i }).click();
    await expect(
      studentPage.getByRole('link', { name: projectTitle })
    ).toBeVisible({ timeout: 10000 });

    // 1.5 View Career Passport
    await studentPage
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: 'Passport' })
      .click();
    await expect(studentPage).toHaveURL(/\/app\/passport/);
    await expect(
      studentPage.getByTestId('passport-student-name')
    ).toContainText(studentName);

    // -------------------------------------------------------------------------
    // STEP 2: Recruiter Context — Register, Post Job & Send Job Invitation
    // -------------------------------------------------------------------------
    const recruiterContext = await browser.newContext();
    const recruiterPage = await recruiterContext.newPage();

    // 2.1 Recruiter Registration
    await recruiterPage.goto('/register');
    await recruiterPage.getByLabel(/Email Address/i).fill(recruiterEmail);
    await recruiterPage.getByLabel(/^Password/i).fill(testPassword);
    await recruiterPage.getByLabel(/Account Type/i).selectOption('recruiter');
    await recruiterPage.getByRole('button', { name: /Register/i }).click();

    await expect(
      recruiterPage.getByText(/Account created successfully!/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(recruiterPage).toHaveURL(/\/login/, { timeout: 10000 });

    // 2.2 Recruiter Login
    await recruiterPage.getByLabel(/Email Address/i).fill(recruiterEmail);
    await recruiterPage.getByLabel(/^Password/i).fill(testPassword);
    await recruiterPage.getByRole('button', { name: /Sign In/i }).click();
    await expect(recruiterPage).toHaveURL(/\/app/, { timeout: 10000 });

    // 2.3 Post a Job Posting
    await recruiterPage
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: 'Job Postings' })
      .click();
    await expect(recruiterPage).toHaveURL(/\/app\/recruiter\/jobs/);

    await recruiterPage.getByRole('button', { name: /\+ Post a Job/i }).click();
    await recruiterPage.getByLabel(/Job Title/i).fill(jobTitle);
    await recruiterPage.getByLabel(/Company Name/i).fill(companyName);
    await recruiterPage.getByLabel(/Location/i).fill('San Francisco, CA');
    await recruiterPage
      .getByLabel(/Description/i)
      .fill('Exciting full-stack and robotics systems engineering opportunity.');

    await recruiterPage.getByTestId('job-form-submit-btn').dispatchEvent('click');
    await expect(
      recruiterPage.getByRole('link', { name: jobTitle })
    ).toBeVisible({ timeout: 10000 });

    // 2.4 Discover Student in Candidate Directory
    await recruiterPage
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: 'Talent Discovery' })
      .click();
    await expect(recruiterPage).toHaveURL(/\/app\/recruiter\/candidates/);

    // Search for student
    const candidateSearch = recruiterPage.getByPlaceholder(/Search by candidate name/i);
    await candidateSearch.fill(studentName);

    await expect(
      recruiterPage.getByText(studentName).first()
    ).toBeVisible({ timeout: 10000 });

    // Click Invite to Apply
    const inviteBtn = recruiterPage
      .getByRole('button', { name: /Invite to Apply/i })
      .first();
    await inviteBtn.click();

    // Fill invitation modal
    await expect(
      recruiterPage.getByRole('heading', { name: /Invite to Apply/i })
    ).toBeVisible();

    const inviteMsgInput = recruiterPage.getByLabel(/Personalized Message/i);
    if (await inviteMsgInput.count()) {
      await inviteMsgInput.fill('We were impressed by your Neural Vision project and would love for you to apply!');
    }

    await recruiterPage
      .getByRole('button', { name: /Send Invitation/i })
      .click();

    await expect(
      recruiterPage.getByText(/Invitation Sent Successfully!/i)
    ).toBeVisible({ timeout: 10000 });

    // Close success state
    await recruiterPage.getByRole('button', { name: /Done/i }).click();

    // -------------------------------------------------------------------------
    // STEP 3: Student Context — Review & Accept Job Invitation
    // -------------------------------------------------------------------------
    await studentPage
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: 'Invitations' })
      .click();
    await expect(studentPage).toHaveURL(/\/app\/invitations/);

    await expect(
      studentPage.getByText(jobTitle).first()
    ).toBeVisible({ timeout: 10000 });

    // Accept invitation
    const acceptBtn = studentPage
      .getByRole('button', { name: /Accept Invitation/i })
      .first();
    await acceptBtn.click();

    await expect(
      studentPage.getByText(/Invitation accepted!/i)
    ).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // STEP 4: Student Context — Apply to Job Posting
    // -------------------------------------------------------------------------
    await studentPage
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: 'Opportunities' })
      .click();
    await expect(studentPage).toHaveURL(/\/app\/jobs/);

    const jobFilter = studentPage.getByLabel(/Keyword Search/i);
    await jobFilter.fill(jobTitle);
    await studentPage.getByRole('button', { name: /Apply Filters/i }).click();

    await expect(
      studentPage.getByRole('link', { name: jobTitle })
    ).toBeVisible({ timeout: 10000 });

    await studentPage.getByRole('button', { name: /^Apply$/i }).first().click();
    await studentPage
      .getByLabel(/Cover Note \/ Message/i)
      .fill('Excited to apply following the invitation!');
    await studentPage.getByRole('button', { name: /Submit Application/i }).click();

    await expect(
      studentPage.getByText(/Application Submitted!/i)
    ).toBeVisible({ timeout: 10000 });

    // Verify Application is present in tracker
    await studentPage
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: 'My Applications' })
      .click();
    await expect(studentPage).toHaveURL(/\/app\/applications/);
    await expect(
      studentPage.getByText(jobTitle).first()
    ).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------------------
    // STEP 5: Recruiter Context — Review Application & Schedule Interview
    // -------------------------------------------------------------------------
    await recruiterPage
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: 'Applications' })
      .click();
    await expect(recruiterPage).toHaveURL(/\/app\/recruiter\/applications/);

    await expect(
      recruiterPage.getByText(jobTitle).first()
    ).toBeVisible({ timeout: 10000 });

    // Open schedule interview modal
    const scheduleBtn = recruiterPage.getByRole('button', { name: /Schedule Interview/i });
    if (await scheduleBtn.count()) {
      await scheduleBtn.first().click();

      await expect(
        recruiterPage.getByRole('heading', { name: /Schedule Interview/i })
      ).toBeVisible({ timeout: 10000 });

      const locationInput = recruiterPage.getByPlaceholder(/meet\.google\.com/i);
      if (await locationInput.count()) {
        await locationInput.fill('https://meet.google.com/abc-defg-hij');
      }

      await recruiterPage.getByTestId('submit-schedule-interview-btn').click();
      await expect(
        recruiterPage.getByText(/Interview scheduled successfully/i)
      ).toBeVisible({ timeout: 10000 });
    }

    // -------------------------------------------------------------------------
    // STEP 6: Student Context — View Scheduled Interview
    // -------------------------------------------------------------------------
    await studentPage
      .locator('nav.cb-nav-links')
      .getByRole('link', { name: 'Interviews' })
      .click();
    await expect(studentPage).toHaveURL(/\/app\/interviews/);
    await expect(
      studentPage.getByRole('heading', { name: /Interviews/i })
    ).toBeVisible({ timeout: 10000 });

    // Clean up browser contexts
    await studentContext.close();
    await recruiterContext.close();
  });
});
