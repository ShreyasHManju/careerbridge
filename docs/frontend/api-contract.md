# CareerBridge — Frontend API Contract & Integration Specification

**Version:** 1.0.0
**Target Platform:** React + TypeScript Frontend
**Backend Reference:** FastAPI + PostgreSQL 16 (`/api/v1`)
**Status:** Frozen Backend Contract (Source of Truth)

---

## 1. Core Network & Architectural Conventions

### 1.1 Base URL and Routing
- **Base API Path:** `/api/v1`
- **Documentation Explorer:** `/docs` (Swagger UI) and `/redoc` (ReDoc)
- **OpenAPI Schema:** `/openapi.json`
- **Root Health Probes:** `GET /` and `GET /health`

### 1.2 Content Negotiation & Headers
- **JSON Endpoints:** All standard REST endpoints expect and send `Content-Type: application/json`.
- **Upload Endpoints:** File upload endpoints (`/resume`, `/profile-image`) require `Content-Type: multipart/form-data` with form field `file`.
- **Authorization Header:** Protected endpoints require the HTTP Bearer scheme:
  ```http
  Authorization: Bearer <access_token>
  ```
- **Active Defense Security Headers:** The backend automatically injects the following headers across all responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### 1.3 CORS Configuration
- Handled by FastAPI `CORSMiddleware`.
- Pre-configured allowed origins: `http://localhost:5173`, `http://127.0.0.1:5173`, and production domains configured via `BACKEND_CORS_ORIGINS`.
- Frontend requests must send credentials (`credentials: 'include'` / `withCredentials: true`) when required.

---

## 2. Standardized Error Handling Contract

CareerBridge uses a centralized error-handling architecture. Every error response—whether originating from business logic, input validation, authentication failure, or unhandled server exceptions—returns a consistent JSON envelope.

### 2.1 Unified Error Response Envelope
```json
{
  "success": false,
  "message": "Human-readable explanation of the error",
  "error_code": "MACHINE_READABLE_ENUM_STRING",
  "detail": "Descriptive details, field validation list, or original exception text"
}
```

### 2.2 ErrorCode Catalog
The `error_code` field contains one of the following enumerated constants:

| ErrorCode Constant | Typical Status | Meaning / Trigger Scenario |
| :--- | :---: | :--- |
| `VALIDATION_ERROR` | 422 | Request body, query parameter, or path parameter failed Pydantic schema validation. |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid `Authorization: Bearer` header. |
| `INVALID_TOKEN` | 401 | JWT signature tampering, malformed token string, or corrupted claims. |
| `TOKEN_EXPIRED` | 401 | JWT timestamp exceeds `exp` claim. Client must re-authenticate. |
| `FORBIDDEN` | 403 | Authenticated user lacks the necessary role permissions for this endpoint. |
| `RESOURCE_OWNERSHIP_ERROR` | 403 | User attempted to access or mutate an object owned by another tenant/user. |
| `NOT_FOUND` | 404 | Target entity ID does not exist in the database or has been deleted. |
| `RESOURCE_CONFLICT` | 409 | Unique constraint conflict (e.g. duplicate email registration). |
| `DUPLICATE_APPLICATION` | 409 | Student attempted to re-apply to an internship they already applied to. |
| `INVALID_STATE` | 400 | Invalid state transition (e.g. rescheduling an already cancelled interview). |
| `FILE_TOO_LARGE` | 400 | Uploaded file size exceeds configured limits (5 MB for resumes, 2 MB for images). |
| `INVALID_FILE_TYPE` | 400 / 415 | Unsupported file extension, prohibited executable extension, or mismatched magic bytes. |
| `RATE_LIMIT_EXCEEDED` | 429 | Sliding-window threshold exceeded on login (returns `Retry-After` header). |
| `BAD_REQUEST` | 400 | Malformed client request or invalid cross-field parameters (e.g. `salary_min > salary_max`). |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled server error. Stack traces and database internals are sanitized. |

### 2.3 HTTP Status Codes Used by CareerBridge

| Status Code | Description | Frontend Handling Strategy |
| :---: | :--- | :--- |
| **200 OK** | Successful read, update, or deletion operation. | Render payload or trigger mutation cache updates. |
| **201 Created** | Successful entity creation or document upload. | Navigate to created resource or update listings. |
| **400 Bad Request** | Business constraint violation (invalid states, file rules). | Display alert banner using `message`. |
| **401 Unauthorized** | Token missing, invalid, or expired. | Clear local auth state; redirect to `/login` with return URL. |
| **403 Forbidden** | RBAC permission failure or ownership violation. | Display "Access Denied" or redirect to designated role dashboard. |
| **404 Not Found** | Resource missing. | Display empty-state graphic or 404 page. |
| **409 Conflict** | Duplicate resource or application collision. | Notify user (e.g. "You have already applied for this role"). |
| **422 Unprocessable** | Pydantic schema validation failure. | Map `detail` array directly to inline form field errors. |
| **429 Too Many Req** | Login brute-force rate limit active. | Disable login button for duration specified in `Retry-After`. |
| **500 Server Error** | Unexpected backend failure. | Display friendly fallback toast ("Server error, please try again later"). |
| **503 Service Unavailable** | Database or upstream service connectivity failure (e.g. `GET /health`). | Display service degradation warning or maintenance banner. |

#### Pydantic 422 Detail Format
When status is `422 Unprocessable Entity`, the `detail` property contains an array of field errors:
```json
{
  "success": false,
  "message": "Request validation failed.",
  "error_code": "VALIDATION_ERROR",
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "password"],
      "msg": "String should have at least 6 characters",
      "input": "short"
    }
  ]
}
```

---

## 3. Authentication & User Session Lifecycle

CareerBridge uses stateless JSON Web Token (JWT) Bearer authentication.

```
┌──────────────┐                  ┌────────────────────────┐                  ┌────────────┐
│ React Client │                  │ FastAPI (/api/v1/auth) │                  │ PostgreSQL │
└──────┬───────┘                  └───────────┬────────────┘                  └─────┬──────┘
       │                                      │                                     │
       │ 1. POST /api/v1/users (Register)     │                                     │
       ├─────────────────────────────────────►│ Validate email & hash password      │
       │                                      ├────────────────────────────────────►│ Insert User
       │◄─────────────────────────────────────┤ HTTP 201 Created (UserResponse)     │
       │                                      │                                     │
       │ 2. POST /api/v1/auth/login           │                                     │
       ├─────────────────────────────────────►│ Rate-limit & verify bcrypt          │
       │                                      ├────────────────────────────────────►│ Verify user
       │◄─────────────────────────────────────┤ HTTP 200 OK (access_token)          │
       │                                      │                                     │
       │ 3. Store Token in Memory/Storage     │                                     │
       │                                      │                                     │
       │ 4. GET /api/v1/auth/me               │                                     │
       │    (Header: Bearer <access_token>)   │ Decode JWT & verify expiration      │
       ├─────────────────────────────────────►├────────────────────────────────────►│ Fetch profile
       │◄─────────────────────────────────────┤ HTTP 200 OK (UserResponse + Role)   │
       │                                      │                                     │
```

### 3.1 Session Specifications & Authentication Architecture

> [!IMPORTANT]
> **CURRENT BACKEND AUTHENTICATION: ACCESS-TOKEN-ONLY JWT AUTHENTICATION**
>
> The CareerBridge backend currently operates an access-token-only security model:
> - **No refresh-token endpoint:** There is no `POST /auth/refresh` endpoint in the backend.
> - **No refresh-token generation:** The server does not issue refresh tokens or store refresh tokens in the database.
> - **No refresh-token validation:** No refresh token handling exists in the codebase.
> - **No server-side logout endpoint:** There is no `POST /auth/logout` route; tokens are completely stateless.
>
> **Access Token Specification:**
> - Format: JSON Web Token (JWT)
> - Cryptographic Algorithm: HMAC-SHA256 (`HS256`)
> - Subject Claim: `sub` contains `str(user_id)`
> - Token Lifespan: Exactly 30 minutes (`settings.ACCESS_TOKEN_EXPIRE_MINUTES = 30`)
> - Transmission: HTTP Request Header `Authorization: Bearer <access_token>`
>
> **Expired or Invalid Token Handling:**
> - Status Code: `HTTP 401 Unauthorized`
> - Error Code: `TOKEN_EXPIRED` (for expired tokens) or `INVALID_TOKEN` (for corrupted/tampered tokens)
> - Detail Message: `"Authentication token has expired"`
>
> **Required Frontend Client Behavior:**
> When receiving a `401 Unauthorized` response with `error_code: TOKEN_EXPIRED`:
> 1. **Preserve Unsaved State:** Serialize and store in-progress form data where practical (e.g. in `sessionStorage`) so user input is not lost.
> 2. **Clear Auth State:** Completely purge the expired JWT from client memory and persistent storage (`localStorage` / `sessionStorage`).
> 3. **Redirect to Login:** Immediately navigate the user to `/login` with an optional `redirect` return path parameter.
> 4. **Require Fresh Login:** Prompt the user to re-enter credentials to acquire a new 30-minute access token.
>
> *Frontend developers must NOT design or attempt to call a refresh-token interceptor or loop because the backend does not support refresh tokens.*

### 3.2 User Roles, Verification & Access Control Matrix

| Role | Intended User Persona | Allowed Areas & Constraints |
| :--- | :--- | :--- |
| `student` | Internship candidates & students | Student profile, resume uploads, profile photos, job discovery, job applications, saved jobs, student interviews, student dashboard, direct messaging. |
| `recruiter` | Employer representatives | Recruiter profile, company info, job creation & management, candidate review, applicant status updates, interview scheduling, recruiter dashboard, direct messaging. |
| `admin` | Institutional platform moderators | User status moderation, recruiter verification, job moderation, admin dashboard, platform user inspection. *(Note: Admins cannot eavesdrop on private student-recruiter conversations).* |

#### Recruiter Administrative Verification
- **Verification Flag:** Recruiter accounts include a boolean field `is_verified` (defaults to `false` upon registration).
- **Administrative Endpoint:** Moderated exclusively by platform administrators via `PATCH /api/v1/admin/recruiters/{user_id}/verification`.
- **Backend Posting Behavior:** According to the current backend implementation, an unverified recruiter (`is_verified == false`) **can still create and publish job postings**. The `is_verified` flag functions as a platform trust badge displayed to candidates.
- **Frontend Guidance:** The frontend should display a "Verified Company" badge or "Pending Verification" label in recruiter profiles and job details, but must **not** artificially block unverified recruiters from posting opportunities unless their account is deactivated by an administrator (`is_active == false`).

---

## 4. Complete API Domain Inventory

### 4.1 Authentication Domain

#### `POST /api/v1/auth/login`
- **Purpose:** Authenticate user credentials and receive a JWT access token.
- **Authentication:** Public (None).
- **Protection:** In-memory sliding-window rate limiter (5 failed attempts per 60 seconds per IP + Email).
- **Request Body:**
  ```json
  {
    "email": "student@example.com",
    "password": "Password123!"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer"
  }
  ```
- **Error Responses:**
  - `401 Unauthorized` (`AUTHENTICATION_REQUIRED`): "Incorrect email or password" or "Inactive user account".
  - `422 Unprocessable Entity` (`VALIDATION_ERROR`): Invalid email format or missing fields.
  - `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`): Rate limit exceeded. Header `Retry-After: <seconds>`.

#### `GET /api/v1/auth/me`
- **Purpose:** Retrieve user profile, account status, and assigned role for the authenticated session.
- **Authentication:** Required (`Bearer <token>`).
- **Required Role:** Any active role (`student`, `recruiter`, `admin`).
- **Success Response (200 OK):**
  ```json
  {
    "id": 1,
    "email": "student@example.com",
    "role": "student",
    "is_active": true,
    "is_verified": false,
    "created_at": "2026-09-19T10:00:00Z",
    "updated_at": "2026-09-19T10:00:00Z"
  }
  ```
- **Error Responses:**
  - `401 Unauthorized` (`AUTHENTICATION_REQUIRED`, `TOKEN_EXPIRED`, `INVALID_TOKEN`).

---

### 4.2 Users Domain

#### `POST /api/v1/users`
- **Purpose:** Public user registration. Creates account and triggers background welcome email.
- **Authentication:** Public (None).
- **Request Body:**
  ```json
  {
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "role": "student" // "student", "recruiter", or "admin"
  }
  ```
- **Success Response (201 Created):** Returns `UserResponse` (excluding password).
- **Error Responses:**
  - `409 Conflict` (`RESOURCE_CONFLICT`): "A user with email '...' already exists."
  - `422 Unprocessable Entity` (`VALIDATION_ERROR`): Password < 6 characters (backend schema enforces `min_length=6`), invalid email, or invalid role. *(Note: The frontend registration UI may recommend 8+ characters for UX password strength, but backend validation threshold is 6).*

#### `GET /api/v1/users`
- **Purpose:** List users across the platform (administrative inspection).
- **Authentication:** Required (`Bearer <token>`).
- **Required Role:** `admin`.
- **Query Parameters:** `skip` (default 0), `limit` (default 100, max 100).
- **Response Shape:** **Raw JSON Array** (`List[UserResponse]`). Uses offset/limit pagination, NOT a paginated envelope (`items`, `page`, etc.).
- **Success Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "email": "student@example.com",
      "role": "student",
      "is_active": true,
      "is_verified": false,
      "created_at": "2026-09-19T10:00:00Z",
      "updated_at": "2026-09-19T10:00:00Z"
    }
  ]
  ```

#### `GET /api/v1/users/{user_id}`
- **Purpose:** Fetch details of a single user.
- **Authentication:** Required.
- **Permissions:** Admin or the user themselves (`user_id == current_user.id`).
- **Success Response (200 OK):** `UserResponse`.
- **Error Responses:** `403 Forbidden`, `404 Not Found`.

#### `PATCH /api/v1/users/{user_id}`
- **Purpose:** Update user attributes (email, role, activation status, verification).
- **Authentication:** Required.
- **Permissions:** Admin or self.
- **Request Body:**
  ```json
  {
    "email": "updated@example.com", // optional
    "role": "student", // optional
    "is_active": true, // optional
    "is_verified": true // optional
  }
  ```
- **Success Response (200 OK):** Updated `UserResponse`.

#### `DELETE /api/v1/users/{user_id}`
- **Purpose:** Delete a user account.
- **Authentication:** Required.
- **Required Role:** `admin`.
- **Success Response (200 OK):** `{"message": "User deleted successfully"}`.

---

### 4.3 Student Profile Domain

#### `POST /api/v1/student/profile`
- **Purpose:** Create initial student profile details.
- **Authentication:** Required (`student` role only).
- **Field Constraints & Schema Alignment:**
  - `full_name`: string (Required on create, min 2, max 100 characters).
  - `phone`: optional string (max 20 characters).
  - `college`: optional string (max 150 characters).
  - `degree`: optional string (max 100 characters).
  - `branch`: optional string (max 100 characters).
  - `graduation_year`: optional integer (between 1900 and 2100).
  - `bio`: optional string (max 1000 characters).
  - `skills`: optional string (max 1000 characters).
  - `github_url`: optional string (max 255 characters).
  - `linkedin_url`: optional string (max 255 characters).
  - `portfolio_url`: optional string (max 255 characters).
  *(Important: Fields `first_name`, `last_name`, `headline`, `education_level`, `institution_name`, `field_of_study`, `cgpa`, and `date_of_birth` do NOT exist in the backend schema and must NOT be sent by the frontend).*
- **Request Body:**
  ```json
  {
    "full_name": "Jane Doe",
    "phone": "+91 9876543210",
    "college": "National Institute of Technology",
    "degree": "B.Tech",
    "branch": "Computer Science and Engineering",
    "graduation_year": 2025,
    "bio": "Passionate software engineer building web applications.",
    "skills": "Python, TypeScript, React, PostgreSQL, Docker",
    "github_url": "https://github.com/janedoe",
    "linkedin_url": "https://linkedin.com/in/janedoe",
    "portfolio_url": "https://janedoe.dev"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "id": 1,
    "user_id": 5,
    "full_name": "Jane Doe",
    "phone": "+91 9876543210",
    "college": "National Institute of Technology",
    "degree": "B.Tech",
    "branch": "Computer Science and Engineering",
    "graduation_year": 2025,
    "bio": "Passionate software engineer building web applications.",
    "skills": "Python, TypeScript, React, PostgreSQL, Docker",
    "github_url": "https://github.com/janedoe",
    "linkedin_url": "https://linkedin.com/in/janedoe",
    "portfolio_url": "https://janedoe.dev",
    "created_at": "2026-09-19T10:00:00Z",
    "updated_at": "2026-09-19T10:00:00Z"
  }
  ```
- **Error Responses:**
  - `409 Conflict` (`RESOURCE_CONFLICT`): Student profile already exists.
  - `422 Unprocessable Entity` (`VALIDATION_ERROR`): Missing `full_name` or validation failure.

#### `GET /api/v1/student/profile`
- **Purpose:** Retrieve the authenticated student's profile.
- **Authentication:** Required (`student` role only).
- **Success Response (200 OK):** `StudentProfileResponse` (same shape as above).
- **Error Responses:** `404 Not Found` (if profile not yet created).

#### `PATCH /api/v1/student/profile`
- **Purpose:** Partially update student profile fields.
- **Authentication:** Required (`student` role only).
- **Request Body:** Any subset of `StudentProfileUpdate` fields (`full_name`, `phone`, `college`, `degree`, `branch`, `graduation_year`, `bio`, `skills`, `github_url`, `linkedin_url`, `portfolio_url`).
- **Success Response (200 OK):** Updated `StudentProfileResponse`.

---

### 4.4 Recruiter / Company Profile Domain

#### `POST /api/v1/recruiter/profile`
- **Purpose:** Create company profile for the authenticated recruiter.
- **Authentication:** Required (`recruiter` role only).
- **Request Body:**
  ```json
  {
    "company_name": "Acme Innovations Ltd",
    "company_description": "Next-generation cloud robotics and automation.",
    "contact_name": "John Smith",
    "phone": "+91 9876500000",
    "company_website": "https://acme.example.com",
    "company_location": "Bengaluru, India",
    "industry": "Software & Robotics",
    "company_size": "50-200"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "id": 1,
    "user_id": 2,
    "company_name": "Acme Innovations Ltd",
    "company_description": "Next-generation cloud robotics and automation.",
    "contact_name": "John Smith",
    "phone": "+91 9876500000",
    "company_website": "https://acme.example.com",
    "company_location": "Bengaluru, India",
    "industry": "Software & Robotics",
    "company_size": "50-200",
    "is_verified": false,
    "created_at": "2026-09-19T10:00:00Z",
    "updated_at": "2026-09-19T10:00:00Z"
  }
  ```
- **Error Responses:** `409 Conflict` (profile already exists).

#### `GET /api/v1/recruiter/profile`
- **Purpose:** Retrieve current recruiter's profile and verification badge status.
- **Authentication:** Required (`recruiter` role only).
- **Success Response (200 OK):** `RecruiterProfileResponse`.

#### `PATCH /api/v1/recruiter/profile`
- **Purpose:** Update company profile details.
- **Authentication:** Required (`recruiter` role only).
- **Permissions & Behavior:** Note that `is_verified` is an administrative badge and cannot be modified by recruiters via this endpoint (only admins can change verification status via `PATCH /api/v1/admin/recruiters/{user_id}/verification`). Note also that in the current backend, unverified recruiters can still post jobs without restriction.
- **Request Body:** Any subset of company profile fields (`company_name`, `company_description`, `contact_name`, `phone`, `company_website`, `company_location`, `industry`, `company_size`).
- **Success Response (200 OK):** Updated `RecruiterProfileResponse`.

---

### 4.5 Jobs & Internships Domain

#### `GET /api/v1/jobs`
- **Purpose:** Search, filter, and paginate active job and internship postings.
- **Authentication:** Required (`Bearer <token>`). Any active role.
- **Query Parameters:**
  - `q` (string): Search term across title, description, company, location, skills.
  - `opportunity_type` (enum): `'internship'` or `'job'`.
  - `employment_type` (enum): `'full_time'`, `'part_time'`, `'contract'`.
  - `is_remote` (boolean): `true` or `false`.
  - `location` (string): Case-insensitive partial match.
  - `skills` (string): Partial match on required skills.
  - `salary_min` (integer, ge=0): Minimum compensation threshold.
  - `salary_max` (integer, ge=0): Maximum compensation threshold.
  - `sort_by` (enum): `'created_at'`, `'application_deadline'`, `'salary_min'` (default: `'created_at'`).
  - `sort_order` (enum): `'asc'`, `'desc'` (default: `'desc'`).
  - `page` (integer, ge=1, default: 1).
  - `page_size` (integer, ge=1, le=100, default: 10).
- **Success Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": 1,
        "recruiter_id": 2,
        "title": "Full-Stack Software Engineering Intern",
        "description": "Develop React components and FastAPI backends.",
        "opportunity_type": "internship",
        "company_name": "Acme Innovations Ltd",
        "location": "Bengaluru, India",
        "is_remote": true,
        "employment_type": "full_time",
        "skills": "React, TypeScript, Python, PostgreSQL",
        "minimum_qualification": "B.Tech / B.E. in Computer Science",
        "experience_required": "Fresher / 0 years",
        "salary_min": 25000,
        "salary_max": 40000,
        "application_deadline": "2026-12-31T23:59:59Z",
        "is_active": true,
        "created_at": "2026-09-19T12:00:00Z",
        "updated_at": "2026-09-19T12:00:00Z"
      }
    ],
    "page": 1,
    "page_size": 10,
    "total": 1,
    "total_pages": 1
  }
  ```

#### `POST /api/v1/jobs`
- **Purpose:** Create and publish a new job or internship posting.
- **Authentication:** Required (`recruiter` role only).
- **Request Body:**
  ```json
  {
    "title": "Backend Python Intern",
    "description": "Build high-performance REST APIs.",
    "opportunity_type": "internship",
    "company_name": "Acme Innovations Ltd",
    "location": "Remote",
    "is_remote": true,
    "employment_type": "full_time",
    "skills": "Python, FastAPI, SQL",
    "minimum_qualification": "B.Tech in CS or IT",
    "experience_required": "0-1 years",
    "salary_min": 30000,
    "salary_max": 45000,
    "application_deadline": "2026-11-30T18:30:00Z"
  }
  ```
- **Success Response (201 Created):** `JobPostingResponse`.

#### `GET /api/v1/jobs/my`
- **Purpose:** Retrieve all opportunities (active and inactive) owned by the current recruiter.
- **Authentication:** Required (`recruiter` role only).
- **Response Shape:** **Raw JSON Array** (`List[JobPostingResponse]`). Does NOT use a paginated envelope.
- **Success Response (200 OK):** Array of `JobPostingResponse` objects.

#### `GET /api/v1/jobs/{job_id}`
- **Purpose:** Get full details of a specific job posting.
- **Authentication:** Required.
- **Success Response (200 OK):** `JobPostingResponse`.
- **Error Responses:** `404 Not Found`.

#### `PATCH /api/v1/jobs/{job_id}`
- **Purpose:** Update posting details or change active status (`is_active: false` to unpublish).
- **Authentication:** Required (`recruiter` role only; must own the job).
- **Request Body:** Partial job fields.
- **Success Response (200 OK):** Updated `JobPostingResponse`.
- **Error Responses:** `403 Forbidden` (`RESOURCE_OWNERSHIP_ERROR`).

#### `DELETE /api/v1/jobs/{job_id}`
- **Purpose:** Permanently remove an opportunity posting.
- **Authentication:** Required (`recruiter` role only; must own the job).
- **Success Response (200 OK):** `{"message": "Job posting deleted successfully"}`.

---

### 4.6 Applications Domain

#### `POST /api/v1/jobs/{job_id}/applications`
- **Purpose:** Student submits an application for an active internship/job.
- **Authentication:** Required (`student` role only).
- **Resume Handling Architecture:** Resume submission is **not** passed per application request. In the CareerBridge backend, candidate resumes are stored globally in the student's profile account (`Resume.student_id == student.id`). The application payload accepts only `cover_message`. When recruiters review candidate applications, the student's attached resume is accessed directly from their profile account.
- **Request Body:**
  ```json
  {
    "cover_message": "I am eager to contribute my React and FastAPI skills to Acme Innovations."
  }
  ```
- **Field Constraints:** `cover_message`: optional string (max 2000 characters). *(Note: Do NOT send `cover_letter` or `resume_id` — those fields are not part of the backend schema).*
- **Success Response (201 Created):**
  ```json
  {
    "id": 1,
    "job_posting_id": 1,
    "student_id": 5,
    "cover_message": "I am eager to contribute my React and FastAPI skills to Acme Innovations.",
    "status": "applied",
    "created_at": "2026-09-19T14:00:00Z",
    "updated_at": "2026-09-19T14:00:00Z"
  }
  ```
  *(Note: Response schema contains `job_posting_id`, `student_id`, `cover_message`, and `status`. It does not contain `job_id` or `resume_id`).*
- **Error Responses:**
  - `400 Bad Request` (`BAD_REQUEST`): Job is inactive or closed.
  - `404 Not Found` (`NOT_FOUND`): Job posting not found.
  - `409 Conflict` (`DUPLICATE_APPLICATION`): "You have already applied for this job posting."

#### `GET /api/v1/applications/me`
- **Purpose:** List all applications submitted by the current student.
- **Authentication:** Required (`student` role only).
- **Response Shape:** **Raw JSON Array** (`List[ApplicationResponse]`). Does NOT use a paginated envelope.
- **Success Response (200 OK):** Array of `ApplicationResponse` objects.

#### `GET /api/v1/applications/{application_id}`
- **Purpose:** Student inspects a specific application they submitted.
- **Authentication:** Required (`student` role only; ownership enforced).
- **Success Response (200 OK):** `ApplicationResponse`.

#### `GET /api/v1/recruiter/applications`
- **Purpose:** List all applications submitted to jobs owned by the current recruiter.
- **Authentication:** Required (`recruiter` role only).
- **Response Shape:** **Raw JSON Array** (`List[ApplicationResponse]`). Does NOT use a paginated envelope.
- **Success Response (200 OK):** Array of candidate `ApplicationResponse` objects.

#### `GET /api/v1/recruiter/applications/{application_id}`
- **Purpose:** Recruiter inspects candidate details and application status for a specific applicant.
- **Authentication:** Required (`recruiter` role only; must own the associated job).
- **Success Response (200 OK):** `ApplicationResponse`.

#### `PATCH /api/v1/recruiter/applications/{application_id}`
- **Purpose:** Advance or change candidate application status.
- **Authentication:** Required (`recruiter` role only; ownership enforced).
- **Request Body:**
  ```json
  {
    "status": "shortlisted" // "applied", "reviewing", "shortlisted", "rejected", "accepted"
  }
  ```
- **Success Response (200 OK):** Updated `ApplicationResponse`. Automatically triggers student notification and transactional email.

---

### 4.7 Saved Jobs (Bookmarks) Domain

#### `POST /api/v1/jobs/{job_id}/save`
- **Purpose:** Bookmark an active job posting for later review.
- **Authentication:** Required (`student` role only).
- **Success Response (201 Created):**
  ```json
  {
    "job_id": 1,
    "is_saved": true,
    "saved_at": "2026-09-19T14:30:00Z"
  }
  ```
- **Error Responses:** `400 Bad Request` (cannot save inactive job), `404 Not Found` (job not found), `409 Conflict` (already bookmarked).

#### `DELETE /api/v1/jobs/{job_id}/save`
- **Purpose:** Remove an opportunity from bookmarked jobs.
- **Authentication:** Required (`student` role only).
- **Success Response (204 No Content):** Empty response body.
- **Error Responses:** `404 Not Found` (saved job record not found).

#### `GET /api/v1/jobs/{job_id}/saved`
- **Purpose:** Check bookmark status of a specific job (used to toggle UI bookmark heart icon).
- **Authentication:** Required (`student` role only).
- **Success Response (200 OK):**
  ```json
  {
    "job_id": 1,
    "is_saved": true,
    "saved_at": "2026-09-19T14:30:00Z"
  }
  ```

#### `GET /api/v1/saved-jobs`
- **Purpose:** List all opportunities bookmarked by the student.
- **Authentication:** Required (`student` role only).
- **Response Shape:** **Raw JSON Array** (`List[SavedJobResponse]`). Does NOT use a paginated envelope.
- **Success Response (200 OK):** Array of `SavedJobResponse` objects.

---

### 4.8 Interviews Domain

#### `POST /api/v1/applications/{application_id}/interviews`
- **Purpose:** Recruiter schedules an interview for a candidate application.
- **Authentication:** Required (`recruiter` role only; must own the job).
- **Field Constraints & Schema Alignment:**
  - `scheduled_at`: datetime in ISO 8601 (Required)
  - `duration_minutes`: integer, 1 to 480 (Required — omitting this triggers an HTTP 422 error)
  - `interview_type`: string enum: `'online'`, `'in_person'`, `'phone'` (Optional, defaults to `'online'`)
  - `location_or_link`: optional string, max 500 characters (Meeting URL or physical location — DO NOT use `meeting_link`)
  - `notes`: optional string, max 2000 characters
- **Request Body:**
  ```json
  {
    "scheduled_at": "2026-10-15T10:00:00Z",
    "duration_minutes": 45,
    "interview_type": "online",
    "location_or_link": "https://meet.google.com/abc-defg-hij",
    "notes": "Technical screening focusing on Python and React."
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "id": 1,
    "application_id": 1,
    "recruiter_id": 2,
    "student_id": 5,
    "job_id": 1,
    "job_title": "Full-Stack Software Engineering Intern",
    "company_name": "Acme Innovations Ltd",
    "candidate_email": "student@example.com",
    "recruiter_email": "recruiter@acme.com",
    "scheduled_at": "2026-10-15T10:00:00Z",
    "duration_minutes": 45,
    "interview_type": "online",
    "location_or_link": "https://meet.google.com/abc-defg-hij",
    "notes": "Technical screening focusing on Python and React.",
    "status": "scheduled",
    "created_at": "2026-09-19T15:00:00Z",
    "updated_at": "2026-09-19T15:00:00Z"
  }
  ```
  *(Automatically dispatches in-app notification and email to candidate).*

#### `GET /api/v1/interviews/me`
- **Purpose:** List upcoming and past interviews scheduled for the authenticated student.
- **Authentication:** Required (`student` role only).
- **Response Shape:** **Raw JSON Array** (`List[InterviewResponse]`). Does NOT use a paginated envelope.
- **Success Response (200 OK):** Array of `InterviewResponse` objects ordered by date.

#### `GET /api/v1/recruiter/interviews`
- **Purpose:** List all interviews scheduled by the current recruiter across their candidate pipeline.
- **Authentication:** Required (`recruiter` role only).
- **Response Shape:** **Raw JSON Array** (`List[InterviewResponse]`). Does NOT use a paginated envelope.
- **Success Response (200 OK):** Array of `InterviewResponse` objects.

#### `GET /api/v1/interviews/{interview_id}`
- **Purpose:** View details of a specific interview.
- **Authentication:** Required (accessible only to the associated student or recruiter).
- **Success Response (200 OK):** `InterviewResponse`.

#### `PATCH /api/v1/interviews/{interview_id}`
- **Purpose:** Reschedule interview time, duration, meeting link, or recruiter notes.
- **Authentication:** Required (`recruiter` role only).
- **Request Body:** Any subset of `InterviewUpdate` fields (`scheduled_at`, `duration_minutes`, `interview_type`, `location_or_link`, `notes`, `status`). Status updates to `'rescheduled'`. Note: field is `location_or_link`, NOT `meeting_link`.
- **Success Response (200 OK):** Updated `InterviewResponse`.

#### `DELETE /api/v1/interviews/{interview_id}`
- **Purpose:** Cancel an interview.
- **Authentication:** Required (`recruiter` role only).
- **Success Response (200 OK):** `InterviewResponse` with `status: "cancelled"`.

---

### 4.9 Notifications Domain

#### `GET /api/v1/notifications`
- **Purpose:** Paginated list of in-app notifications for the authenticated user, ordered newest first.
- **Authentication:** Required.
- **Query Parameters:**
  - `page` (integer, ge=1, default: 1)
  - `page_size` (integer, ge=1, le=100, default: 10)
  - `unread_only` (boolean, default: false)
- **Success Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": 12,
        "user_id": 5,
        "title": "Application Shortlisted",
        "message": "Congratulations! Your application for 'Full-Stack Software Engineering Intern' was shortlisted.",
        "notification_type": "application_status",
        "is_read": false,
        "created_at": "2026-09-19T15:30:00Z"
      }
    ],
    "page": 1,
    "page_size": 10,
    "total": 1,
    "total_pages": 1
  }
  ```

#### `GET /api/v1/notifications/unread-count`
- **Purpose:** Lightweight counter for navigation bar badge counters.
- **Authentication:** Required.
- **Success Response (200 OK):** `{"unread_count": 3}`.

#### `PATCH /api/v1/notifications/{notification_id}/read`
- **Purpose:** Mark a single notification as read.
- **Authentication:** Required (ownership enforced).
- **Success Response (200 OK):** Updated `NotificationResponse` (`is_read: true`).

#### `PATCH /api/v1/notifications/read-all`
- **Purpose:** Mark all unread notifications as read.
- **Authentication:** Required.
- **Success Response (200 OK):** `{"marked_read_count": 3}`.

---

### 4.10 Messaging Domain (HTTP)

#### `GET /api/v1/conversations`
- **Purpose:** List all active conversations for the authenticated user, newest message first.
- **Authentication:** Required.
- **Response Shape:** **Conversation Summary Envelope** (`{ "items": [...], "total": int }`). Does NOT include `page` or `page_size`.
- **Success Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": 1,
        "created_at": "2026-09-19T10:00:00Z",
        "updated_at": "2026-09-19T16:00:00Z",
        "other_participant": {
          "id": 2,
          "email": "recruiter@acme.com",
          "role": "recruiter",
          "full_name": "John Smith",
          "company_name": "Acme Innovations Ltd"
        },
        "last_message": {
          "id": 45,
          "conversation_id": 1,
          "sender_id": 2,
          "sender_email": "recruiter@acme.com",
          "body": "Hi Jane, we would like to schedule a technical chat.",
          "is_read": false,
          "created_at": "2026-09-19T16:00:00Z"
        },
        "unread_count": 1
      }
    ],
    "total": 1
  }
  ```

#### `POST /api/v1/conversations`
- **Purpose:** Initiate or retrieve an existing one-to-one conversation with another user.
- **Authentication:** Required.
- **Field Constraints & Schema Alignment:**
  - `other_user_id`: integer, required (must be > 0). *(Important: DO NOT send `recipient_id` — the backend schema requires `other_user_id` and will reject `recipient_id` with an HTTP 422 error).*
  - `initial_message`: optional string (1 to 5000 characters).
- **Request Body:**
  ```json
  {
    "other_user_id": 2,
    "initial_message": "Hi, I have a question about the software engineering internship."
  }
  ```
- **Success Response (201 Created or 200 OK):** `ConversationResponse` (returns 201 if newly created, or 200 if existing conversation reused).

#### `GET /api/v1/conversations/{conversation_id}`
- **Purpose:** Get single conversation metadata and participants.
- **Authentication:** Required (participant only; no admin bypass).
- **Success Response (200 OK):** `ConversationResponse`.

#### `GET /api/v1/conversations/{conversation_id}/messages`
- **Purpose:** Paginated list of message history in a conversation.
- **Authentication:** Required (participant only).
- **Query Parameters:** `page` (default 1), `page_size` (default 20, max 100).
- **Response Shape:** **Message History Envelope** (`{ "items": [...], "total": int, "page": int, "page_size": int, "total_pages": int }`).
- **Success Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": 1,
        "conversation_id": 1,
        "sender_id": 5,
        "sender_email": "student@example.com",
        "body": "Hello, thank you for reviewing my application!",
        "is_read": true,
        "read_at": "2026-09-19T16:05:00Z",
        "created_at": "2026-09-19T15:55:00Z",
        "updated_at": "2026-09-19T15:55:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "page_size": 20,
    "total_pages": 1
  }
  ```

#### `POST /api/v1/conversations/{conversation_id}/messages`
- **Purpose:** Send a message via HTTP fallback (alternative to WebSocket).
- **Authentication:** Required (participant only).
- **Request Body:** `{"body": "Hello! I am ready for the interview."}` (max 5,000 chars).
- **Success Response (201 Created):** `MessageResponse`. Broadcasts real-time event to connected WebSocket clients.

#### `PATCH /api/v1/conversations/{conversation_id}/read`
- **Purpose:** Mark all incoming messages in a conversation as read.
- **Authentication:** Required (participant only).
- **Success Response (200 OK):**
  ```json
  {
    "conversation_id": 1,
    "marked_read_count": 2
  }
  ```

#### `PATCH /api/v1/messages/{message_id}/read`
- **Purpose:** Mark a specific received message as read.
- **Authentication:** Required (recipient only).
- **Success Response (200 OK):** Updated `MessageResponse`.

---

### 4.11 Dashboards Domain

#### `GET /api/v1/dashboard/student`
- **Purpose:** Real-time metrics for authenticated student dashboard.
- **Authentication:** Required (`student` role only).
- **Success Response (200 OK):**
  ```json
  {
    "total_applications": 8,
    "applications_under_review": 3,
    "shortlisted_applications": 2,
    "accepted_applications": 1,
    "saved_internships": 5,
    "upcoming_interviews": 2
  }
  ```

#### `GET /api/v1/dashboard/recruiter`
- **Purpose:** Real-time hiring pipeline metrics for authenticated recruiter.
- **Authentication:** Required (`recruiter` role only).
- **Success Response (200 OK):**
  ```json
  {
    "active_internships": 4,
    "total_applications": 32,
    "applications_awaiting_review": 14,
    "shortlisted_candidates": 6,
    "scheduled_interviews": 5
  }
  ```

#### `GET /api/v1/dashboard/admin`
- **Purpose:** Platform-wide metrics and growth indicators.
- **Authentication:** Required (`admin` role only).
- **Query Parameters:** `period_year` (optional integer, e.g. `2026`).
- **Success Response (200 OK):**
  ```json
  {
    "total_students": 142,
    "total_companies": 28,
    "verified_companies": 22,
    "published_internships": 35,
    "total_applications": 310,
    "application_success_rate": 18.5,
    "monthly_registrations": [
      { "month": "2026-08", "count": 45 },
      { "month": "2026-09", "count": 68 }
    ]
  }
  ```

---

### 4.12 Administration Domain

#### `GET /api/v1/admin/users`
- **Purpose:** List users with filtering, search, and pagination.
- **Authentication:** Required (`admin` role only).
- **Query Parameters:** `search` (string partial match across email, NOT `q`), `role` (`student`, `recruiter`, `admin`), `is_active` (boolean), `page` (default 1), `page_size` (default 10).
- **Response Shape:** **Paginated Envelope** (`items`, `page`, `page_size`, `total`, `total_pages`).
- **Success Response (200 OK):** `AdminUserPaginationResponse`.

#### `GET /api/v1/admin/users/{user_id}`
- **Purpose:** Inspect detailed user account data.
- **Authentication:** Required (`admin` role only).
- **Success Response (200 OK):** `UserResponse`.

#### `PATCH /api/v1/admin/users/{user_id}/status`
- **Purpose:** Activate or deactivate a user account (e.g. suspension). Prevents admin self-lockout.
- **Authentication:** Required (`admin` role only).
- **Request Body:** `{"is_active": false}`.
- **Success Response (200 OK):** Updated `UserResponse`.

#### `GET /api/v1/admin/recruiters`
- **Purpose:** Review company profiles awaiting verification or moderation.
- **Authentication:** Required (`admin` role only).
- **Query Parameters:** `search` (string partial match on company name, contact, phone, NOT `q`), `is_verified` (boolean), `page`, `page_size`.
- **Response Shape:** **Paginated Envelope** (`items`, `page`, `page_size`, `total`, `total_pages`).
- **Success Response (200 OK):** `AdminRecruiterPaginationResponse`.

#### `PATCH /api/v1/admin/recruiters/{user_id}/verification`
- **Purpose:** Grant or revoke verified company status.
- **Authentication:** Required (`admin` role only).
- **Behavior:** Moderates the company verification badge. In the current backend, unverified recruiters can still post jobs; this verification badge is a platform trust indicator displayed to students.
- **Request Body:** `{"is_verified": true}`.
- **Success Response (200 OK):** Updated `AdminRecruiterResponse`.

#### `GET /api/v1/admin/jobs`
- **Purpose:** Platform-wide job moderation listing.
- **Authentication:** Required (`admin` role only).
- **Query Parameters:** `search` (string partial match on title, description, company name, NOT `q`), `opportunity_type`, `employment_type`, `is_active`, `page`, `page_size`.
- **Response Shape:** **Paginated Envelope** (`items`, `page`, `page_size`, `total`, `total_pages`).
- **Success Response (200 OK):** `JobPostingPaginationResponse`.

#### `PATCH /api/v1/admin/jobs/{job_id}/status`
- **Purpose:** Moderate or take down a job posting.
- **Authentication:** Required (`admin` role only).
- **Request Body:** `{"is_active": false}`.
- **Success Response (200 OK):** Updated `JobPostingResponse`.

---

### 4.13 Files Domain (Resumes & Profile Images)

#### `POST /api/v1/resume`
- **Purpose:** Upload or replace the student's resume.
- **Authentication:** Required (`student` role only).
- **Content-Type:** `multipart/form-data`.
- **Form Field:** `file` (Binary document).
- **Allowed Formats:** `.pdf`, `.doc`, `.docx`.
- **Size Limit:** 5 MB.
- **Validation:** Magic bytes signature verification, filename sanitization, UUID storage.
- **Success Response (201 Created):**
  ```json
  {
    "id": 1,
    "student_id": 5,
    "original_filename": "Jane_Doe_Resume.pdf",
    "stored_filename": "a1b2c3d4e5f6...pdf",
    "file_path": "/app/uploads/resumes/a1b2c3d4e5f6...pdf",
    "file_size": 184520,
    "created_at": "2026-09-19T10:00:00Z",
    "updated_at": "2026-09-19T10:00:00Z"
  }
  ```
- **Error Responses:**
  - `400 Bad Request` (`INVALID_FILE_TYPE`): Disallowed or dangerous extension.
  - `400 Bad Request` (`FILE_TOO_LARGE`): Exceeds 5 MB.

#### `GET /api/v1/resume`
- **Purpose:** Retrieve current student's resume metadata.
- **Authentication:** Required (`student` role only).
- **Success Response (200 OK):** `ResumeResponse`.

#### `GET /api/v1/resume/download`
- **Purpose:** Download resume file binary (`Content-Disposition: attachment`).
- **Authentication:** Required (`student` role only).
- **Success Response (200 OK):** Binary stream (`application/pdf`).

#### `DELETE /api/v1/resume`
- **Purpose:** Delete stored resume and database record.
- **Authentication:** Required (`student` role only).
- **Success Response (200 OK):** `{"message": "Resume deleted successfully"}`.

#### `POST /api/v1/profile-image`
- **Purpose:** Upload or replace student profile avatar.
- **Authentication:** Required (`student` role only).
- **Content-Type:** `multipart/form-data`.
- **Form Field:** `file` (Binary image).
- **Allowed Formats:** `.jpg`, `.jpeg`, `.png`, `.webp`.
- **Size Limit:** 2 MB.
- **Validation:** Magic bytes inspection (`FF D8 FF` for JPEG, `89 PNG` for PNG, `RIFF...WEBP` for WebP).
- **Success Response (201 Created):** `ProfileImageResponse`.

#### `GET /api/v1/profile-image`
- **Purpose:** Retrieve profile image metadata.
- **Authentication:** Required (`student` role only).
- **Success Response (200 OK):** `ProfileImageResponse`.

#### `GET /api/v1/profile-image/download`
- **Purpose:** Serve profile image binary (`Content-Type: image/jpeg` or equivalent).
- **Authentication:** Required (`student` role only).
- **Success Response (200 OK):** Binary image stream.

#### `DELETE /api/v1/profile-image`
- **Purpose:** Delete avatar from storage.
- **Authentication:** Required (`student` role only).
- **Success Response (200 OK):** `{"message": "Profile image deleted successfully"}`.

---

### 4.14 Health & System Domain

#### `GET /`
- **Purpose:** Root health ping.
- **Authentication:** Public.
- **Success Response (200 OK):** `{"message": "CareerBridge API", "status": "ok"}`.

#### `GET /health`
- **Purpose:** Active health and database connectivity probe.
- **Authentication:** Public.
- **Success Response (200 OK):**
  ```json
  {
    "status": "ok",
    "database": "connected",
    "service": "CareerBridge API"
  }
  ```
- **Error Response (503 Service Unavailable):**
  ```json
  {
    "success": false,
    "message": "Database connection failed",
    "error_code": "INTERNAL_SERVER_ERROR",
    "detail": "Database connection failed"
  }
  ```

---

### 4.15 Role-Based Access Control (RBAC) Diagnostic Endpoints

The backend provides four dedicated diagnostic endpoints under `/api/v1/rbac` for verifying role authorization and permission enforcement:

#### `GET /api/v1/rbac/student`
- **Purpose:** Diagnostic endpoint accessible strictly to users with the `student` role.
- **Authentication:** Required (`student` role only).
- **Success Response (200 OK):** `{"message": "Student access granted", "role": "student"}`.
- **Error Response:** `403 Forbidden` (`FORBIDDEN`) for non-student roles.

#### `GET /api/v1/rbac/recruiter`
- **Purpose:** Diagnostic endpoint accessible strictly to users with the `recruiter` role.
- **Authentication:** Required (`recruiter` role only).
- **Success Response (200 OK):** `{"message": "Recruiter access granted", "role": "recruiter"}`.
- **Error Response:** `403 Forbidden` (`FORBIDDEN`) for non-recruiter roles.

#### `GET /api/v1/rbac/admin`
- **Purpose:** Diagnostic endpoint accessible strictly to users with the `admin` role.
- **Authentication:** Required (`admin` role only).
- **Success Response (200 OK):** `{"message": "Admin access granted", "role": "admin"}`.
- **Error Response:** `403 Forbidden` (`FORBIDDEN`) for non-admin roles.

#### `GET /api/v1/rbac/student-or-recruiter`
- **Purpose:** Diagnostic endpoint accessible to either `student` or `recruiter` roles. Rejected for `admin`.
- **Authentication:** Required (`student` or `recruiter`).
- **Success Response (200 OK):** `{"message": "Student or recruiter access granted", "role": "<role>"}`.
- **Error Response:** `403 Forbidden` (`FORBIDDEN`) for admin users.

---

### 4.16 Collection Response Taxonomy & Envelopes Overview

To prevent frontend client parsing errors (such as attempting to read `.items` on a raw array), all collection endpoints are classified according to their exact JSON response structure:

| Endpoint Path | HTTP Method | Response Shape Type | Structure Summary |
| :--- | :---: | :--- | :--- |
| `/api/v1/jobs` | `GET` | **Paginated Envelope** | `{ items: JobPostingResponse[], page, page_size, total, total_pages }` |
| `/api/v1/admin/jobs` | `GET` | **Paginated Envelope** | `{ items: JobPostingResponse[], page, page_size, total, total_pages }` |
| `/api/v1/admin/users` | `GET` | **Paginated Envelope** | `{ items: UserResponse[], page, page_size, total, total_pages }` |
| `/api/v1/admin/recruiters` | `GET` | **Paginated Envelope** | `{ items: AdminRecruiterResponse[], page, page_size, total, total_pages }` |
| `/api/v1/notifications` | `GET` | **Paginated Envelope** | `{ items: NotificationResponse[], page, page_size, total, total_pages }` |
| `/api/v1/conversations/{id}/messages` | `GET` | **Message History Envelope** | `{ items: MessageResponse[], total, page, page_size, total_pages }` |
| `/api/v1/conversations` | `GET` | **Summary Envelope** | `{ items: ConversationResponse[], total }` *(No page/page_size)* |
| `/api/v1/applications/me` | `GET` | **Raw JSON Array** | `ApplicationResponse[]` *(Direct array; do not access .items)* |
| `/api/v1/recruiter/applications` | `GET` | **Raw JSON Array** | `ApplicationResponse[]` *(Direct array; do not access .items)* |
| `/api/v1/jobs/my` | `GET` | **Raw JSON Array** | `JobPostingResponse[]` *(Direct array; do not access .items)* |
| `/api/v1/saved-jobs` | `GET` | **Raw JSON Array** | `SavedJobResponse[]` *(Direct array; do not access .items)* |
| `/api/v1/interviews/me` | `GET` | **Raw JSON Array** | `InterviewResponse[]` *(Direct array; do not access .items)* |
| `/api/v1/recruiter/interviews` | `GET` | **Raw JSON Array** | `InterviewResponse[]` *(Direct array; do not access .items)* |
| `/api/v1/users` | `GET` | **Raw JSON Array** | `UserResponse[]` *(Direct array; uses skip/limit query params)* |

---

## 5. Real-Time WebSocket Messaging Contract

### 5.1 Connection Endpoint
```
ws://<host>/api/v1/ws/conversations/{conversation_id}?token=<jwt_access_token>
```
*(In production, encrypted connection uses `wss://`)*

### 5.2 Handshake & Authorization Flow
1. **Token Extraction:** The token is supplied via query parameter `?token=...` or standard `Authorization: Bearer` header during handshake.
2. **Token Validation:** Verifies JWT signature and expiry. Failure immediately closes the socket with close code `1008 (Policy Violation)`:
   - Reason: `"Missing authentication token"` or `"Invalid or expired token"`.
3. **Participant Verification:** The backend verifies that the authenticated user ID is either `user1_id` or `user2_id` of the specified `conversation_id`.
   - Admin users are **not permitted** to eavesdrop on conversations they do not participate in (`1008 Policy Violation`).
4. **Multi-Tab Synchronization:** The connection manager supports multiple concurrent WebSocket connections per user ID. Messages are synchronized across all open browser tabs.

### 5.3 Client-to-Server Events (Sent by React Frontend)

#### Send Message Event
```json
{
  "type": "message",
  "body": "Hello, I am looking forward to our scheduled discussion."
}
```
- **Validation:** Body must be a non-empty string between 1 and 5,000 characters.
- **Side Effect:** Automatically persists message in PostgreSQL and broadcasts to other participants.

#### Mark Read Event
```json
{
  "type": "read" // or "mark_read"
}
```
- **Side Effect:** Updates unread messages in the database and broadcasts `messages_read` to participants.

#### Heartbeat Ping Event
```json
{
  "type": "ping"
}
```
- **Response:** Immediate `{"type": "pong"}` frame.

### 5.4 Server-to-Client Events (Received by React Frontend)

#### New Message Broadcast (`new_message`)
```json
{
  "type": "new_message",
  "message": {
    "id": 84,
    "conversation_id": 1,
    "sender_id": 2,
    "sender_email": "recruiter@acme.com",
    "body": "Hi Jane! Could you share your portfolio link?",
    "is_read": false,
    "read_at": null,
    "created_at": "2026-09-19T17:00:00Z",
    "updated_at": "2026-09-19T17:00:00Z"
  }
}
```

#### Messages Read Event (`messages_read`)
```json
{
  "type": "messages_read",
  "conversation_id": 1,
  "reader_id": 5,
  "marked_read_count": 2,
  "read_at": "2026-09-19T17:01:00Z"
}
```

#### Heartbeat Pong (`pong`)
```json
{
  "type": "pong"
}
```

#### Error Frame (`error`)
```json
{
  "type": "error",
  "code": "MESSAGE_TOO_LONG",
  "message": "Message body cannot exceed 5000 characters"
}
```

### 5.5 In-Memory Connection Architecture & Scale Limits
- **Single Process Constraint:** Active WebSocket connections are tracked in Python process memory (`ws_manager._connections`).
- **Implication for Frontend:** The frontend custom WebSocket hook must handle disconnections gracefully with exponential backoff reconnect logic, while retaining the single-instance backend topology currently configured.
