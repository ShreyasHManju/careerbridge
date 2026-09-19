# CareerBridge — Frontend Architectural Blueprint & Integration Plan

**Version:** 1.0.0
**Target Stack:** React 18+ / TypeScript 5+ / Vite / Tailwind CSS
**Target Backend:** CareerBridge FastAPI REST + WebSocket Server (`/api/v1`)
**Status:** Planning Document Only (Zero Implementation in This Phase)

---

## 1. Architectural Principles & Technology Selection

The CareerBridge frontend will be developed as a modern, high-performance, single-page application (SPA) designed to serve students, recruiters, and administrators with strict role-based tenant isolation.

### 1.1 Core Technology Choices
- **Build Tool:** [Vite](https://vitejs.dev/) — Lightning-fast Hot Module Replacement (HMR) and optimized Rollup-based production builds.
- **Language:** TypeScript (Strict Mode) — 100% type-safe integration with the backend OpenAPI schema.
- **Routing:** [React Router v6+](https://reactrouter.com/) — Declarative nested layouts, protected route guards, and role-based redirect logic.
- **Server State & Caching:** [TanStack Query v5](https://tanstack.com/query/latest) — Declarative query caching, automatic background re-fetching, optimistic updates, and garbage collection.
- **Client & Auth State:** Lightweight reactive store (e.g., Zustand or React Context + Hook) for session token persistence and active user profile state.
- **Form Management & Validation:** [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) — Performant, non-rendering form state coupled with schema-driven validation matching Pydantic backend models.
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) — Utility-first, responsive, accessible design system with role-specific color accents (e.g. Student Blue, Recruiter Emerald, Admin Slate).
- **Icons:** [Lucide React](https://lucide.dev/) — Clean, consistent, tree-shakeable iconography.
- **HTTP Client:** [Axios](https://axios-http.com/) — Built-in request/response interceptors for automatic JWT header injection and standardized error envelope parsing.

---

## 2. Proposed Project Structure

Adapted specifically to CareerBridge's 14 backend domains:

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── public/
│   ├── favicon.ico
│   ├── manifest.json              # Future PWA manifest
│   └── icons/
└── src/
    ├── main.tsx                   # Application root mount
    ├── App.tsx                    # Router & query client provider setup
    │
    ├── api/                       # HTTP client & generated API interfaces
    │   ├── client.ts              # Axios instance with interceptors
    │   ├── endpoints.ts           # Centralized API endpoint constants
    │   └── types/                 # TypeScript interfaces generated from OpenAPI
    │
    ├── auth/                      # Authentication & Session Management
    │   ├── AuthContext.tsx        # Session state provider (token & user)
    │   ├── useAuth.ts             # Hook for accessing auth context
    │   ├── tokenStorage.ts        # Secure token storage utilities
    │   └── roleGuards.tsx         # <ProtectedRoute> & <RoleRoute> wrappers
    │
    ├── components/                # Shared, domain-agnostic UI primitives
    │   ├── ui/                    # Button, Input, Modal, Badge, Dropdown, Toast
    │   ├── layout/                # Navbar, Sidebar, PageHeader, Footer
    │   ├── feedback/              # LoadingSpinner, SkeletonLoader, EmptyState
    │   └── errors/                # ErrorBoundary, ErrorAlert, FormFieldError
    │
    ├── features/                  # Domain-specific feature modules
    │   ├── auth/                  # Login, Register, ForgotPassword forms
    │   ├── student-profile/       # Bio, Education, Skills, ProfilePhotoUpload
    │   ├── recruiter-profile/     # CompanyInfo, VerificationBadge, EditProfile
    │   ├── resumes/               # ResumeUploadModal, ResumeViewer, DeleteResume
    │   ├── jobs/                  # JobList, JobCard, JobFilters, JobDetail, JobForm
    │   ├── applications/          # ApplyModal, ApplicationHistory, CandidateReview
    │   ├── saved-jobs/            # SavedJobsList, BookmarkButton
    │   ├── interviews/            # InterviewScheduleModal, InterviewList, Calendar
    │   ├── notifications/         # NotificationBell, NotificationDropdown, MarkAll
    │   ├── messaging/             # ChatWindow, ConversationList, MessageBubble
    │   ├── dashboards/            # StudentDashboard, RecruiterDashboard, AdminDashboard
    │   └── admin/                 # UserModerationTable, CompanyVerification, JobReview
    │
    ├── hooks/                     # Custom shared React hooks
    │   ├── useWebSocket.ts        # Real-time WebSocket connection manager
    │   ├── useDebounce.ts         # Search input debouncing (for job discovery)
    │   └── usePagination.ts       # Page/size state management
    │
    ├── routes/                    # Route tree configuration
    │   └── index.tsx              # AppRoutes definition with lazy-loaded pages
    │
    └── utils/                     # Formatting, dates, error mapping
        ├── formatters.ts          # Salary (INR/USD), dates (dayjs/date-fns)
        ├── errorMapper.ts         # Maps backend ErrorCode to UI message
        └── validators.ts          # Shared Zod validation schemas
```

---

## 3. Core Architecture Subsystems

### 3.1 HTTP Client & Interceptor Layer (`src/api/client.ts`)
The API client standardizes request preparation and response error normalization:

```typescript
// Architectural Pattern (Conceptual)
import axios, { AxiosError } from 'axios';
import { tokenStorage } from '@/auth/tokenStorage';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Request Interceptor: Attach JWT Bearer Token
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Normalize Structured Backend Errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    if (error.response?.status === 401) {
      // Token expired or invalid: dispatch global logout event
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    // Unwrap structured error envelope { success, message, error_code, detail }
    return Promise.reject(error.response?.data || error);
  }
);
```

### 3.2 Authentication & Role Guards
Routes are partitioned into Public, Authenticated, and Role-Gated:

```typescript
// Conceptual Route Guard
export function ProtectedRoute({ allowedRoles }: { allowedRoles?: UserRole[] }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
```

### 3.3 Server State Management with TanStack Query
- **Query Keys Factory:** Centralized query key definitions (`['jobs', { page, q, filter }]`, `['notifications', 'unread']`).
- **Cache Invalidation:** Mutations automatically invalidate relevant query keys (e.g. Submitting an application invalidates `['applications', 'me']` and `['dashboard', 'student']`).
- **Optimistic Updates:** Immediate UI updates for bookmarking (`POST /jobs/{id}/save`) and mark-read actions.

### 3.4 Form Management & Validation
Forms are bound using React Hook Form with Zod schemas matching backend constraints:
- **Registration Form:** Validates email, password complexity (min 8 chars), and role selection.
- **Job Creation Form:** Cross-validates `salary_min <= salary_max` on client-side before sending to prevent 422 errors.
- **Backend Error Translation:** 422 field errors from FastAPI (`exc.errors()`) are automatically set into React Hook Form via `setError(field, { message })`.

### 3.5 File Upload Subsystem
- Upload components utilize `multipart/form-data` with drag-and-drop support.
- **Client-Side Pre-Validation:**
  - Resumes: Size <= 5 MB; extensions strictly `.pdf`, `.doc`, `.docx`.
  - Profile Photos: Size <= 2 MB; extensions strictly `.jpg`, `.jpeg`, `.png`, `.webp`.
- Shows upload progress bar using Axios `onUploadProgress`.

### 3.6 Real-Time WebSocket Messaging Hook (`useWebSocket`)
A custom hook encapsulates real-time conversation synchronization:
- Automatically connects to `ws://<host>/api/v1/ws/conversations/${conversationId}?token=${token}` when chat view mounts.
- Implements exponential backoff reconnects (1s, 2s, 4s, up to 30s) on unexpected disconnects.
- Sends periodic `{"type": "ping"}` heartbeats every 30 seconds to keep reverse proxy connections alive.
- Integrates directly with TanStack Query cache: incoming `new_message` events append directly to the message cache without requiring full page reloads.

### 3.7 Notification Architecture
- Global navigation bar mounts a polling hook for `GET /notifications/unread-count` (e.g. refetching every 60s).
- Clicking notification dropdown fetches paginated notifications and offers a one-click `Mark All Read` action.

### 3.8 PWA (Progressive Web App) Readiness
- Service worker registration configured via `vite-plugin-pwa`.
- Web App Manifest configured for mobile homescreen installations.
- Offline fallback shell displaying cached application navigation.

---

## 4. Frontend Integration Risks & Mitigation Strategies

| Integration Vector | Technical Risk | Mitigation Strategy |
| :--- | :--- | :--- |
| **Token Expiry (401)** | User is in the middle of filling a lengthy application or job form when the 30-min JWT expires. | Axios response interceptor catches 401 `TOKEN_EXPIRED`, serializes form state to `sessionStorage`, redirects to login, and restores draft state on return. |
| **Login Rate Limiting (429)** | User triggers 5 failed attempts and gets locked out without clear UI guidance. | Interceptor inspects HTTP 429 and `Retry-After` response header; displays a live countdown timer disabling the submit button until expiry. |
| **In-Memory WebSocket Disconnects** | Network blips or container restarts terminate real-time chat sockets. | `useWebSocket` hook auto-reconnects with exponential backoff and automatically falls back to HTTP endpoints (`POST /conversations/{id}/messages`) if socket is unavailable. |
| **Multipart Upload Validation** | User uploads an unsupported format or >5 MB file, receiving an abrupt error. | Immediate client-side validation via HTML5 File API before network transmission; checks exact file size and MIME type. |
| **Cross-Role Route Access** | Student accidentally navigates to `/admin` or `/recruiter` routes. | Declarative `<RoleRoute allowedRoles={['admin']}>` immediately redirects unauthorized roles to their designated home dashboard with a toast notification. |
| **Pagination Out-of-Bounds** | Applying tight search filters reduces total pages while client remains on a higher page number. | `usePagination` automatically resets `page: 1` whenever search query `q` or filter state changes. |
| **CORS / Proxy Configuration** | Development requests fail due to missing cross-origin headers. | Vite dev server configured with `server.proxy` pointing `/api/v1` to `http://localhost:8000`, eliminating dev-time CORS issues. |
| **Silent Backend Exception Sanitization** | Production 500 errors return generic error envelopes without debug details. | UI displays a clean, user-friendly fallback component with a "Report Issue" action referencing the timestamp. |

---

## 5. Roadmap-Aligned Implementation Sequence

The frontend must **NOT** be developed monolithically. Development must follow the original engineering roadmap as incremental, vertically integrated phases:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-01: Foundation & Tooling                                       │
│ Vite + React + TypeScript + Tailwind + Axios client + Router setup     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-02: Authentication & Session Management                        │
│ Login, Registration, JWT storage, /auth/me, Protected & Role Routes   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-03: User & Student Profile Management                          │
│ Profile forms, Resume upload/view (PDF), Avatar upload, Validation    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-04: Candidate Opportunity Discovery                            │
│ Job browsing, search (debounced), filtering, sorting, pagination cards │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-05: Application Submission & Bookmarks                         │
│ Apply modal (cover letter + resume select), Saved jobs toggle, Status  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-06: Recruiter Pipeline & Job Management                        │
│ Job posting creation/edit, Applicant review, Candidate status updates  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-07: Interview Scheduling Workflows                             │
│ Recruiter interview modal, Student interview agenda, meeting links     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-08: In-App Notifications Subsystem                             │
│ Notification bell, unread badge, dropdown list, mark-as-read actions   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-09: Direct & Real-Time WebSocket Messaging                     │
│ Conversation list, chat window, WebSocket hook, read receipts, fallback│
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-10: Aggregated Role Dashboards                                 │
│ Student dashboard, Recruiter pipeline metrics, Admin analytics         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-11: Platform Administration & Moderation                       │
│ User activation/deactivation, Company verification, Job moderation     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase F-12: PWA, Hardening & End-to-End Testing                        │
│ Service worker, manifest, Lighthouse audit, Vitest, Playwright E2E    │
└────────────────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> This roadmap guarantees that every frontend screen is grounded in an existing, tested, and production-ready backend API endpoint. Zero mock backends are required.
