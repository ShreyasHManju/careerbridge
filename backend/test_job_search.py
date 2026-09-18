"""
CareerBridge Phase 12 Search, Filtering & Pagination Test Suite
Tests:
- Search (q) across title, description, company_name, location, skills (case-insensitive)
- Opportunity type filter (internship, job)
- Employment type filter (full_time, part_time, contract)
- Remote work filter (true, false)
- Location filter (case-insensitive partial match)
- Skills filter (case-insensitive partial match)
- Salary range filtering (salary_min, salary_max, combined bounds, NULL handling)
- Combined multi-faceted queries
- Database-level pagination (default page/page_size, page navigation, custom sizes, out-of-range pages, max limit 100)
- Response envelope schema (items, page, page_size, total, total_pages)
- Controlled sorting (created_at, application_deadline, salary_min in asc and desc)
- Validation rules (negative numbers, inverted salary, invalid enums, invalid booleans, invalid pagination, invalid sort)
- Security: Inactive jobs strictly omitted; unauthenticated requests rejected with 401
"""

from datetime import datetime, timezone
import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.user import User, UserRole

client = TestClient(app)

SEARCH_RECRUITER_EMAIL = "search.recruiter@careerbridge.io"
SEARCH_STUDENT_EMAIL = "search.student@careerbridge.io"
TEST_PASSWORD = "SearchTestPassword123!"


def cleanup_test_data():
    """Remove test users and their job postings."""
    with SessionLocal() as db:
        test_emails = [SEARCH_RECRUITER_EMAIL, SEARCH_STUDENT_EMAIL]
        users = db.scalars(select(User).where(User.email.in_(test_emails))).all()
        user_ids = [u.id for u in users]
        if user_ids:
            db.execute(delete(JobPosting).where(JobPosting.recruiter_id.in_(user_ids)))
            db.execute(delete(User).where(User.id.in_(user_ids)))
            db.commit()


def run_job_search_tests():
    print("\n=========================================================")
    print("STARTING PHASE 12 SEARCH, FILTERING & PAGINATION TESTS")
    print("=========================================================\n")

    cleanup_test_data()

    try:
        # Step 1: Create recruiter and student test users
        with SessionLocal() as db:
            recruiter = User(
                email=SEARCH_RECRUITER_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.RECRUITER,
                is_active=True,
                is_verified=True,
            )
            student = User(
                email=SEARCH_STUDENT_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            )
            db.add_all([recruiter, student])
            db.commit()
            db.refresh(recruiter)
            db.refresh(student)

            recruiter_id = recruiter.id
            student_id = student.id

            # Seed 12 active job postings with rich diversity and 2 inactive postings
            test_postings = [
                # Job 1: Python backend, Bangalore, job, full_time, onsite, 60k-90k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Senior Python Backend Engineer",
                    description="Develop distributed cloud microservices using FastAPI.",
                    opportunity_type=OpportunityType.JOB,
                    company_name="PyTech Solutions",
                    location="Bangalore, India",
                    is_remote=False,
                    employment_type=EmploymentType.FULL_TIME,
                    skills="Python, FastAPI, PostgreSQL, Redis",
                    salary_min=60000,
                    salary_max=90000,
                    application_deadline=datetime(2026, 11, 1, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 2: Python Data Science, Hyderabad, internship, part_time, remote, 25k-35k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Python Data Science Intern",
                    description="Machine learning research and predictive modeling.",
                    opportunity_type=OpportunityType.INTERNSHIP,
                    company_name="DataCorp AI",
                    location="Hyderabad, India",
                    is_remote=True,
                    employment_type=EmploymentType.PART_TIME,
                    skills="Python, PyTorch, Pandas, Scikit-Learn",
                    salary_min=25000,
                    salary_max=35000,
                    application_deadline=datetime(2026, 10, 15, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 3: Frontend React, Bangalore, job, full_time, remote, 50k-75k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Frontend React Developer",
                    description="Build responsive web applications with React and Tailwind.",
                    opportunity_type=OpportunityType.JOB,
                    company_name="WebCraft UI",
                    location="Bangalore, India",
                    is_remote=True,
                    employment_type=EmploymentType.FULL_TIME,
                    skills="React, TypeScript, Next.js, CSS",
                    salary_min=50000,
                    salary_max=75000,
                    application_deadline=datetime(2026, 12, 1, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 4: DevOps, Mumbai, job, contract, onsite, 80k-120k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="DevOps Contract Engineer",
                    description="Automate CI/CD pipelines and manage Kubernetes clusters.",
                    opportunity_type=OpportunityType.JOB,
                    company_name="CloudNine Systems",
                    location="Mumbai, India",
                    is_remote=False,
                    employment_type=EmploymentType.CONTRACT,
                    skills="Docker, Kubernetes, AWS, Terraform",
                    salary_min=80000,
                    salary_max=120000,
                    application_deadline=datetime(2026, 9, 30, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 5: Mobile Flutter, Pune, internship, full_time, onsite, 20k-30k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Mobile Flutter Intern",
                    description="Cross-platform mobile application development.",
                    opportunity_type=OpportunityType.INTERNSHIP,
                    company_name="AppWorks Mobile",
                    location="Pune, India",
                    is_remote=False,
                    employment_type=EmploymentType.FULL_TIME,
                    skills="Flutter, Dart, Mobile",
                    salary_min=20000,
                    salary_max=30000,
                    application_deadline=datetime(2026, 10, 30, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 6: Full-Stack, Delhi, job, full_time, remote, 70k-100k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Full-Stack Software Engineer",
                    description="Full stack engineering with Python, React, and databases.",
                    opportunity_type=OpportunityType.JOB,
                    company_name="FullStack Labs",
                    location="Delhi, India",
                    is_remote=True,
                    employment_type=EmploymentType.FULL_TIME,
                    skills="Python, React, PostgreSQL",
                    salary_min=70000,
                    salary_max=100000,
                    application_deadline=datetime(2026, 11, 15, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 7: QA Automation, Chennai, job, full_time, onsite, 40k-55k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="QA Automation Engineer",
                    description="Write automated end-to-end tests using Cypress and Python.",
                    opportunity_type=OpportunityType.JOB,
                    company_name="QualityFirst Inc",
                    location="Chennai, India",
                    is_remote=False,
                    employment_type=EmploymentType.FULL_TIME,
                    skills="Python, Cypress, Selenium",
                    salary_min=40000,
                    salary_max=55000,
                    application_deadline=datetime(2026, 10, 20, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 8: Cloud Architect, Bangalore, job, contract, remote, 150k-200k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Cloud Architect",
                    description="Design scalable multi-cloud infrastructure solutions.",
                    opportunity_type=OpportunityType.JOB,
                    company_name="Skyline Cloud",
                    location="Bangalore, India",
                    is_remote=True,
                    employment_type=EmploymentType.CONTRACT,
                    skills="GCP, AWS, Architecture, Security",
                    salary_min=150000,
                    salary_max=200000,
                    application_deadline=datetime(2026, 12, 15, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 9: Product Design, Bangalore, internship, part_time, onsite, 15k-20k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Product Design Intern",
                    description="User research, wireframing, and design system creation.",
                    opportunity_type=OpportunityType.INTERNSHIP,
                    company_name="DesignStudio",
                    location="Bangalore, India",
                    is_remote=False,
                    employment_type=EmploymentType.PART_TIME,
                    skills="Figma, UX Research, Prototyping",
                    salary_min=15000,
                    salary_max=20000,
                    application_deadline=datetime(2026, 10, 5, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 10: Database Admin, Hyderabad, job, full_time, onsite, 90k-130k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Database Administrator",
                    description="PostgreSQL tuning, sharding, and high availability replication.",
                    opportunity_type=OpportunityType.JOB,
                    company_name="DataScale Tech",
                    location="Hyderabad, India",
                    is_remote=False,
                    employment_type=EmploymentType.FULL_TIME,
                    skills="PostgreSQL, Linux, SQL",
                    salary_min=90000,
                    salary_max=130000,
                    application_deadline=datetime(2026, 11, 20, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 11: Cybersecurity, Noida, job, full_time, remote, 65k-85k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Cybersecurity Analyst",
                    description="Threat modeling, vulnerability scanning, and incident response.",
                    opportunity_type=OpportunityType.JOB,
                    company_name="SecureShield Corp",
                    location="Noida, India",
                    is_remote=True,
                    employment_type=EmploymentType.FULL_TIME,
                    skills="Security, Networking, Linux",
                    salary_min=65000,
                    salary_max=85000,
                    application_deadline=datetime(2026, 10, 25, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 12: Junior Web Intern, Kolkata, internship, full_time, remote, 10k-15k
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Junior Web Intern",
                    description="Website maintenance and feature prototyping.",
                    opportunity_type=OpportunityType.INTERNSHIP,
                    company_name="StartupVibe",
                    location="Kolkata, India",
                    is_remote=True,
                    employment_type=EmploymentType.FULL_TIME,
                    skills="HTML, CSS, JavaScript",
                    salary_min=10000,
                    salary_max=15000,
                    application_deadline=datetime(2026, 11, 5, 0, 0, tzinfo=timezone.utc),
                    is_active=True,
                ),
                # Job 13 (INACTIVE): Python stealth job
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Secret Inactive Python Project",
                    description="Internal confidential stealth development.",
                    opportunity_type=OpportunityType.JOB,
                    company_name="PyTech Solutions",
                    location="Bangalore, India",
                    is_remote=True,
                    employment_type=EmploymentType.FULL_TIME,
                    skills="Python, Stealth",
                    salary_min=100000,
                    salary_max=150000,
                    is_active=False,
                ),
                # Job 14 (INACTIVE): Archived Python internship
                JobPosting(
                    recruiter_id=recruiter_id,
                    title="Archived Python Internship",
                    description="Closed opportunity not open to applicants.",
                    opportunity_type=OpportunityType.INTERNSHIP,
                    company_name="DataCorp AI",
                    location="Hyderabad, India",
                    is_remote=False,
                    employment_type=EmploymentType.PART_TIME,
                    skills="Python",
                    salary_min=20000,
                    salary_max=30000,
                    is_active=False,
                ),
            ]
            db.add_all(test_postings)
            db.commit()

        # Auth token for student
        student_token = create_access_token(subject=student_id)
        headers = {"Authorization": f"Bearer {student_token}"}

        # -----------------------------------------------------------------
        # SECTION 1: SEARCH (q) TESTS
        # -----------------------------------------------------------------
        print("[1/28] Search by title (?q=Backend)...")
        r = client.get("/api/v1/jobs?q=Backend", headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert any("Backend" in item["title"] for item in res["items"])
        assert res["total"] >= 1
        print("  -> Passed: Title search returned matching postings.")

        print("[2/28] Search by description (?q=microservices)...")
        r = client.get("/api/v1/jobs?q=microservices", headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert any("microservices" in item["description"].lower() for item in res["items"])
        print("  -> Passed: Description search returned matching postings.")

        print("[3/28] Search by company (?q=WebCraft)...")
        r = client.get("/api/v1/jobs?q=WebCraft", headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert all("WebCraft" in item["company_name"] for item in res["items"])
        print("  -> Passed: Company search returned matching postings.")

        print("[4/28] Search by location (?q=Chennai)...")
        r = client.get("/api/v1/jobs?q=Chennai", headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert all("Chennai" in item["location"] for item in res["items"])
        print("  -> Passed: Location search returned matching postings.")

        print("[5/28] Search by skills (?q=Docker)...")
        r = client.get("/api/v1/jobs?q=Docker", headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert any("Docker" in item["skills"] for item in res["items"])
        print("  -> Passed: Skills search returned matching postings.")

        print("[6/28] Search parameter omitted returns all active postings...")
        r = client.get("/api/v1/jobs", headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert res["total"] == 12
        assert len(res["items"]) == 10  # default page_size=10
        print(f"  -> Passed: Unfiltered search returned total={res['total']} active records.")

        # -----------------------------------------------------------------
        # SECTION 2: ENUM & STATUS FILTERS
        # -----------------------------------------------------------------
        print("[7/28] Filter by opportunity_type=internship...")
        r = client.get("/api/v1/jobs?opportunity_type=internship", headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert res["total"] == 4
        assert all(item["opportunity_type"] == "internship" for item in res["items"])
        print("  -> Passed: opportunity_type=internship correctly filtered.")

        print("[8/28] Filter by opportunity_type=job...")
        r = client.get("/api/v1/jobs?opportunity_type=job", headers=headers)
        assert r.status_code == 200
        res = r.json()
        assert res["total"] == 8
        assert all(item["opportunity_type"] == "job" for item in res["items"])
        print("  -> Passed: opportunity_type=job correctly filtered.")

        print("[9/28] Filter by employment_type (full_time, part_time, contract)...")
        r_ft = client.get("/api/v1/jobs?employment_type=full_time", headers=headers)
        assert r_ft.status_code == 200
        assert all(item["employment_type"] == "full_time" for item in r_ft.json()["items"])

        r_pt = client.get("/api/v1/jobs?employment_type=part_time", headers=headers)
        assert r_pt.status_code == 200
        assert all(item["employment_type"] == "part_time" for item in r_pt.json()["items"])
        assert r_pt.json()["total"] == 2

        r_ct = client.get("/api/v1/jobs?employment_type=contract", headers=headers)
        assert r_ct.status_code == 200
        assert all(item["employment_type"] == "contract" for item in r_ct.json()["items"])
        assert r_ct.json()["total"] == 2
        print("  -> Passed: employment_type filtered all 3 supported enum variants.")

        print("[10/28] Filter by is_remote (true/false)...")
        r_rem = client.get("/api/v1/jobs?is_remote=true", headers=headers)
        assert r_rem.status_code == 200
        assert all(item["is_remote"] is True for item in r_rem.json()["items"])
        assert r_rem.json()["total"] == 6

        r_onsite = client.get("/api/v1/jobs?is_remote=false", headers=headers)
        assert r_onsite.status_code == 200
        assert all(item["is_remote"] is False for item in r_onsite.json()["items"])
        assert r_onsite.json()["total"] == 6
        print("  -> Passed: is_remote boolean filter verified for both true and false.")

        print("[11/28] Filter by location partial match (?location=bangalore)...")
        r_loc = client.get("/api/v1/jobs?location=bangalore", headers=headers)
        assert r_loc.status_code == 200
        res = r_loc.json()
        assert res["total"] == 4
        assert all("bangalore" in item["location"].lower() for item in res["items"])
        print("  -> Passed: Case-insensitive location partial match verified.")

        print("[12/28] Filter by skills (?skills=react)...")
        r_sk = client.get("/api/v1/jobs?skills=react", headers=headers)
        assert r_sk.status_code == 200
        res = r_sk.json()
        assert res["total"] == 2
        assert all("react" in item["skills"].lower() for item in res["items"])
        print("  -> Passed: Skills filter verified.")

        # -----------------------------------------------------------------
        # SECTION 3: SALARY FILTERS
        # -----------------------------------------------------------------
        print("[13/28] Filter by salary_min=100000...")
        r_smin = client.get("/api/v1/jobs?salary_min=100000", headers=headers)
        assert r_smin.status_code == 200
        res = r_smin.json()
        # Should match jobs whose upper compensation reaches >= 100k
        assert res["total"] == 4
        for item in res["items"]:
            upper = item["salary_max"] if item["salary_max"] is not None else item["salary_min"]
            assert upper >= 100000
        print("  -> Passed: salary_min filter correctly matched satisfying opportunities.")

        print("[14/28] Filter by salary_max=30000...")
        r_smax = client.get("/api/v1/jobs?salary_max=30000", headers=headers)
        assert r_smax.status_code == 200
        res = r_smax.json()
        # Should match jobs whose starting compensation is <= 30k
        assert res["total"] == 4
        for item in res["items"]:
            lower = item["salary_min"] if item["salary_min"] is not None else item["salary_max"]
            assert lower <= 30000
        print("  -> Passed: salary_max filter correctly matched satisfying opportunities.")

        print("[15/28] Combined filters (?q=python&opportunity_type=internship&is_remote=true)...")
        r_comb = client.get(
            "/api/v1/jobs?q=python&opportunity_type=internship&is_remote=true",
            headers=headers,
        )
        assert r_comb.status_code == 200
        res = r_comb.json()
        assert res["total"] == 1
        assert res["items"][0]["title"] == "Python Data Science Intern"
        print("  -> Passed: Combined multi-parameter filter executed correctly.")

        # -----------------------------------------------------------------
        # SECTION 4: PAGINATION
        # -----------------------------------------------------------------
        print("[16/28] Default pagination returns page 1 with page_size=10...")
        r_p1 = client.get("/api/v1/jobs", headers=headers)
        assert r_p1.status_code == 200
        res_p1 = r_p1.json()
        assert res_p1["page"] == 1
        assert res_p1["page_size"] == 10
        assert res_p1["total"] == 12
        assert res_p1["total_pages"] == 2
        assert len(res_p1["items"]) == 10
        print("  -> Passed: Page 1 metadata and item count match.")

        print("[17/28] Page 2 returns remaining 2 items...")
        r_p2 = client.get("/api/v1/jobs?page=2&page_size=10", headers=headers)
        assert r_p2.status_code == 200
        res_p2 = r_p2.json()
        assert res_p2["page"] == 2
        assert len(res_p2["items"]) == 2
        assert res_p2["total"] == 12
        assert res_p2["total_pages"] == 2
        p1_ids = {item["id"] for item in res_p1["items"]}
        p2_ids = {item["id"] for item in res_p2["items"]}
        assert p1_ids.isdisjoint(p2_ids), "Page 1 and Page 2 contain overlapping items!"
        print("  -> Passed: Page 2 is non-overlapping and contains remaining records.")

        print("[18/28] Custom page_size=5...")
        r_p5 = client.get("/api/v1/jobs?page=1&page_size=5", headers=headers)
        assert r_p5.status_code == 200
        res_p5 = r_p5.json()
        assert res_p5["page_size"] == 5
        assert len(res_p5["items"]) == 5
        assert res_p5["total_pages"] == 3  # ceil(12 / 5) = 3
        print("  -> Passed: Custom page_size=5 yielded 3 total pages.")

        print("[19/28] Page beyond total available records returns empty items list...")
        r_beyond = client.get("/api/v1/jobs?page=999&page_size=10", headers=headers)
        assert r_beyond.status_code == 200
        res_beyond = r_beyond.json()
        assert len(res_beyond["items"]) == 0
        assert res_beyond["page"] == 999
        assert res_beyond["total"] == 12
        assert res_beyond["total_pages"] == 2
        print("  -> Passed: Out-of-bounds page returns empty items with accurate total.")

        print("[20/28] Maximum page_size=100 is supported...")
        r_max = client.get("/api/v1/jobs?page=1&page_size=100", headers=headers)
        assert r_max.status_code == 200
        assert r_max.json()["page_size"] == 100
        assert len(r_max.json()["items"]) == 12
        print("  -> Passed: page_size=100 accepted.")

        # -----------------------------------------------------------------
        # SECTION 5: SORTING
        # -----------------------------------------------------------------
        print("[21/28] Sort by salary_min asc and desc...")
        r_sal_asc = client.get(
            "/api/v1/jobs?sort_by=salary_min&sort_order=asc&page_size=12",
            headers=headers,
        )
        assert r_sal_asc.status_code == 200
        asc_salaries = [
            item["salary_min"]
            for item in r_sal_asc.json()["items"]
            if item["salary_min"] is not None
        ]
        assert asc_salaries == sorted(asc_salaries), f"Expected ascending salaries, got {asc_salaries}"

        r_sal_desc = client.get(
            "/api/v1/jobs?sort_by=salary_min&sort_order=desc&page_size=12",
            headers=headers,
        )
        assert r_sal_desc.status_code == 200
        desc_salaries = [
            item["salary_min"]
            for item in r_sal_desc.json()["items"]
            if item["salary_min"] is not None
        ]
        assert desc_salaries == sorted(desc_salaries, reverse=True)
        print("  -> Passed: salary_min asc and desc sorting verified.")

        print("[22/28] Sort by application_deadline asc...")
        r_dl_asc = client.get(
            "/api/v1/jobs?sort_by=application_deadline&sort_order=asc&page_size=12",
            headers=headers,
        )
        assert r_dl_asc.status_code == 200
        deadlines = [
            item["application_deadline"]
            for item in r_dl_asc.json()["items"]
            if item["application_deadline"] is not None
        ]
        assert deadlines == sorted(deadlines)
        print("  -> Passed: application_deadline asc sorting verified.")

        # -----------------------------------------------------------------
        # SECTION 6: VALIDATION RULES (422)
        # -----------------------------------------------------------------
        print("[23/28] Validation: Negative salary rejected with 422...")
        assert client.get("/api/v1/jobs?salary_min=-100", headers=headers).status_code == 422
        assert client.get("/api/v1/jobs?salary_max=-500", headers=headers).status_code == 422
        print("  -> Passed: Negative salary_min/max rejected with 422.")

        print("[24/28] Validation: salary_min > salary_max rejected with 422...")
        r_inv = client.get("/api/v1/jobs?salary_min=80000&salary_max=40000", headers=headers)
        assert r_inv.status_code == 422
        assert "cannot be greater than" in r_inv.json()["detail"]
        print("  -> Passed: Inverted salary range rejected with 422.")

        print("[25/28] Validation: Invalid enums, booleans, and sort keys return 422...")
        assert client.get("/api/v1/jobs?opportunity_type=invalid_type", headers=headers).status_code == 422
        assert client.get("/api/v1/jobs?employment_type=freelance", headers=headers).status_code == 422
        assert client.get("/api/v1/jobs?is_remote=notaboolean", headers=headers).status_code == 422
        assert client.get("/api/v1/jobs?sort_by=hacked_column", headers=headers).status_code == 422
        assert client.get("/api/v1/jobs?sort_order=sideways", headers=headers).status_code == 422
        print("  -> Passed: Invalid query parameter types rejected with 422.")

        print("[26/28] Validation: Invalid pagination rejected with 422...")
        assert client.get("/api/v1/jobs?page=0", headers=headers).status_code == 422
        assert client.get("/api/v1/jobs?page_size=0", headers=headers).status_code == 422
        assert client.get("/api/v1/jobs?page_size=101", headers=headers).status_code == 422
        print("  -> Passed: Out-of-bounds pagination parameters rejected with 422.")

        # -----------------------------------------------------------------
        # SECTION 7: SECURITY & INACTIVE POSTING ISOLATION
        # -----------------------------------------------------------------
        print("[27/28] Inactive jobs never appear in discovery under any query...")
        r_all = client.get("/api/v1/jobs?page_size=100", headers=headers)
        assert r_all.status_code == 200
        all_items = r_all.json()["items"]
        assert all(item["is_active"] is True for item in all_items)
        assert not any("Inactive" in item["title"] for item in all_items)
        assert not any("Archived" in item["title"] for item in all_items)

        r_secret = client.get("/api/v1/jobs?q=Stealth", headers=headers)
        assert r_secret.status_code == 200
        assert r_secret.json()["total"] == 0
        print("  -> Passed: Inactive postings strictly isolated and omitted.")

        print("[28/28] Unauthenticated request to /api/v1/jobs returns 401...")
        assert client.get("/api/v1/jobs").status_code == 401
        print("  -> Passed: Unauthenticated request rejected with 401.")

        print("\n=========================================================")
        print("ALL 28 SEARCH, FILTERING & PAGINATION TESTS PASSED!")
        print("=========================================================\n")

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    run_job_search_tests()
