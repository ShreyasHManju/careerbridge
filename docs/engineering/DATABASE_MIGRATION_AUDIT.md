# CareerBridge Database Migration and Schema Audit

**Date:** 2026-10-19
**Repository Working Copy:** `C:\CareerBridge-Safety-Copy`
**Disposable Database Target:** `internship_test_db` in container `careerbridge-test-disposable`
**Current Alembic Head:** `b8c9d0e1f2a3`
**Audit Status:** Phase 3 Complete — Verified Evidence

---

## 1. Alembic Environment & Configuration Inspection

### A. Configuration File (`backend/alembic.ini`)
- `script_location = alembic`
- Target metadata binds to `app.models.base.Base.metadata`.
- Connection URL is dynamic via `backend/alembic/env.py`.

### B. Migration Environment (`backend/alembic/env.py`)
- Configured with `get_migration_url()` helper:
  - If `CAREERBRIDGE_TEST_MODE == "1"` or `TEST_DATABASE_URL` is set, calls `app.core.test_database.validate_test_database_url()`.
  - Fails closed if `TEST_DATABASE_URL` is missing, targets protected databases, or references non-test database names.
  - Falls back to `settings.sync_database_url` only when not in test mode.

---

## 2. Migration History and Chain Validation

The migration graph was inspected via `python -m alembic history`. The chain is strictly linear with exactly one head and zero branching.

| Order | Revision ID | Down Revision | Description |
| :---: | :--- | :--- | :--- |
| 01 | `ddf450ed3742` | `<base>` | Create initial users table |
| 02 | `a178948eff11` | `ddf450ed3742` | Create student_profiles table |
| 03 | `823b612d228b` | `a178948eff11` | Create recruiter_profiles table |
| 04 | `a80f62ac6bac` | `823b612d228b` | Create job_postings table |
| 05 | `faeac51e9591` | `a80f62ac6bac` | Create applications table |
| 06 | `4a2d4af2e3d9` | `faeac51e9591` | Create resumes table |
| 07 | `952c21322497` | `4a2d4af2e3d9` | Create profile_images table |
| 08 | `87af405ae2a4` | `952c21322497` | Create saved_jobs table |
| 09 | `01b1d6a76f10` | `87af405ae2a4` | Add is_verified to recruiter_profiles |
| 10 | `81b0d94726f4` | `01b1d6a76f10` | Create notifications table |
| 11 | `ebd151e3ae62` | `81b0d94726f4` | Create interviews table |
| 12 | `6a1607782c51` | `ebd151e3ae62` | Create messaging tables |
| 13 | `c3f88a91b24d` | `6a1607782c51` | Add performance indexes |
| 14 | `e8a3182b8a21` | `c3f88a91b24d` | Create notification_preferences table |
| 15 | `f1a8c9032d17` | `e8a3182b8a21` | Create structured skills tables & backfill legacy skills |
| 16 | `c4b8e21a9f05` | `f1a8c9032d17` | Create innovation projects & project skills tables |
| 17 | `d7e9f12b3c48` | `c4b8e21a9f05` | Create project milestones table |
| 18 | `e4c7b819f2a0` | `d7e9f12b3c48` | Create experience records tables |
| 19 | `d4862ba643b7` | `e4c7b819f2a0` | Align enum types and constraints |
| 20 | `23d1824b3816` | `d4862ba643b7` | Create project_evidence table |
| 21 | `31a78e49b120` | `23d1824b3816` | Create project_evidence_verifications table |
| 22 | `4f82b9a7c1e5` | `31a78e49b120` | Create project_evaluations tables |
| 23 | `5b7c9d1e2f30` | `4f82b9a7c1e5` | Add google authentication fields |
| 24 | `7c8d9e0f1a2b` | `5b7c9d1e2f30` | Create job invitations table |
| 25 | `8d9e0f1a2b3c` | `7c8d9e0f1a2b` | Align job invitations contract |
| 26 | `9e0f1a2b3c4d` | `8d9e0f1a2b3c` | Widen notification type column for experience verification |
| 27 | `b7e2c9a1d4f8` | `9e0f1a2b3c4d` | Create candidate_evaluations table |
| 28 | `c8f3e1a2b4d9` | `b7e2c9a1d4f8` | Create job_offers table |
| 29 | `f3a1b2c4d5e6` | `c8f3e1a2b4d9` | Create passport_shares table |
| 30 | `a7b8c9d0e1f2` | `f3a1b2c4d5e6` | Create project_blueprints tables & link to innovation projects |
| 31 | `b8c9d0e1f2a3` | `a7b8c9d0e1f2` | Create password_reset_tokens table (**HEAD**) |

- **Number of Heads:** 1 (`b8c9d0e1f2a3`)
- **Branches:** 0
- **Divergences:** None

---

## 3. Disposable Database Verification

Independent internal administrative query of `careerbridge-test-disposable`:
```sql
SELECT version_num FROM alembic_version;
```
Result:
```
 version_num
--------------
 b8c9d0e1f2a3
```

### Table Inventory (35 tables confirmed in public schema)
1. `alembic_version`
2. `applications`
3. `candidate_evaluations`
4. `conversation_participants`
5. `conversations`
6. `evaluation_skill_assessments`
7. `experience_records`
8. `experience_skills`
9. `innovation_projects`
10. `interviews`
11. `job_invitations`
12. `job_offers`
13. `job_postings`
14. `job_skills`
15. `messages`
16. `notification_preferences`
17. `notifications`
18. `passport_shares`
19. `password_reset_tokens`
20. `profile_images`
21. `project_blueprint_milestones`
22. `project_blueprint_skills`
23. `project_blueprints`
24. `project_evaluations`
25. `project_evidence`
26. `project_evidence_verifications`
27. `project_milestones`
28. `project_skills`
29. `recruiter_profiles`
30. `resumes`
31. `saved_jobs`
32. `skills`
33. `student_profiles`
34. `student_skills`
35. `users`

---

## 4. Model vs. Migration Alignment

1. **`ProjectEvaluation` Model (`backend/app/models/project_evaluation.py`):**
   - Migration `4f82b9a7c1e5` creates explicit named indexes `ix_project_evaluations_student_id` and `ix_project_evaluations_recruiter_id`.
   - The model defines these indexes in `__table_args__`.
   - Redundant `index=True` parameters on `student_id` and `recruiter_id` columns were removed, preventing duplicate index generation.

2. **`CandidateEvaluation` Model (`backend/app/models/candidate_evaluation.py`):**
   - Migration `b7e2c9a1d4f8` creates indexes for `application_id`, `interview_id`, `recruiter_id`, and `status`.
   - The model mirrors this in `__table_args__` without redundant column-level flags.

3. **Status:** Full model-to-migration fidelity verified. No schema drift or orphaned migrations detected.
