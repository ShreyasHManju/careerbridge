"""
CareerBridge Section 31 API Documentation & OpenAPI Specification Test Suite
Validates the FastAPI OpenAPI documentation system:
1. GET /docs returns HTTP 200 and loads Swagger UI.
2. GET /openapi.json returns HTTP 200 and a valid OpenAPI 3.1 schema.
3. OpenAPI title and version match project identity ("CareerBridge API", "1.0.0").
4. OpenAPI description outlines platform capabilities and conventions.
5. Tag metadata definitions are registered for all major platform domains.
6. HTTPBearer security scheme is defined in components.
7. Protected endpoints contain the expected security requirements.
8. Public endpoints (e.g. /api/v1/auth/login, /api/v1/users POST, /health, /) do not require authentication.
9. Representative write endpoints expose correct request body schemas (e.g. login, jobs, applications, interviews).
10. Endpoints expose typed response schemas on 200/201 success responses.
11. Path parameters across all routes include descriptive documentation.
12. Security review: OpenAPI schema contains zero leaked secrets or credentials.
"""

from pathlib import Path
import sys

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.core.config import settings
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_01_docs_endpoint_returns_200_and_loads_swagger_ui():
    """Verify GET /docs returns HTTP 200 and contains Swagger UI HTML markup."""
    res = client.get("/docs")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    content_type = res.headers.get("content-type", "")
    assert "text/html" in content_type, f"Expected text/html content-type, got: {content_type}"
    assert "swagger-ui" in res.text.lower(), "Swagger UI HTML markup missing from /docs response"


def test_02_openapi_json_endpoint_returns_200_and_valid_json():
    """Verify GET /openapi.json returns HTTP 200 and valid JSON document."""
    res = client.get("/openapi.json")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    content_type = res.headers.get("content-type", "")
    assert "application/json" in content_type or "application/openapi+json" in content_type
    schema = res.json()
    assert isinstance(schema, dict), "OpenAPI response must be a JSON object"
    assert "openapi" in schema, "OpenAPI version field missing"
    assert "paths" in schema, "OpenAPI paths field missing"
    assert "info" in schema, "OpenAPI info field missing"


def test_03_openapi_metadata_title_version_and_description():
    """Verify OpenAPI document exposes correct title, version, and platform description."""
    schema = app.openapi()
    info = schema.get("info", {})

    assert info.get("title") == "CareerBridge API", f"Unexpected title: {info.get('title')}"
    assert info.get("version") == "1.0.0", f"Unexpected version: {info.get('version')}"
    description = info.get("description", "")
    assert "CareerBridge" in description
    assert "Authentication" in description
    assert "Student Management" in description or "Student" in description
    assert "Recruiter" in description


def test_04_openapi_tags_metadata_registered():
    """Verify tag metadata definitions are registered for all major platform domains."""
    schema = app.openapi()
    tags = schema.get("tags", [])
    assert len(tags) >= 10, f"Expected at least 10 tag metadata definitions, found {len(tags)}"

    tag_names = {t["name"] for t in tags}
    expected_tags = [
        "Authentication",
        "Users",
        "Student Profile",
        "Recruiter Profile",
        "Jobs & Internships",
        "Applications",
        "Saved Jobs",
        "Interviews",
        "Notifications",
        "Messaging",
        "Resume & Documents",
        "Profile Image",
        "Dashboards",
        "Admin",
        "RBAC Demonstration",
        "Health",
    ]
    for expected in expected_tags:
        assert expected in tag_names, f"Missing tag metadata definition for '{expected}'"


def test_05_openapi_security_schemes_configured():
    """Verify OpenAPI components define the HTTPBearer security scheme."""
    schema = app.openapi()
    components = schema.get("components", {})
    security_schemes = components.get("securitySchemes", {})

    assert "HTTPBearer" in security_schemes, "HTTPBearer security scheme missing from OpenAPI components"
    bearer_scheme = security_schemes["HTTPBearer"]
    assert bearer_scheme.get("type") == "http"
    assert bearer_scheme.get("scheme") == "bearer"
    assert "description" in bearer_scheme


def test_06_authenticated_and_public_endpoints_security_requirements():
    """Verify authenticated endpoints have security requirements and public routes do not."""
    schema = app.openapi()
    paths = schema.get("paths", {})

    # Representative public routes
    public_endpoints = [
        ("get", "/"),
        ("get", "/health"),
        ("post", "/api/v1/auth/login"),
        ("post", "/api/v1/users"),
    ]
    for method, path in public_endpoints:
        op = paths.get(path, {}).get(method)
        assert op is not None, f"Endpoint {method.upper()} {path} missing from OpenAPI schema"
        sec = op.get("security", [])
        assert len(sec) == 0, f"Public endpoint {method.upper()} {path} should not have security requirement: {sec}"

    # Representative authenticated routes
    auth_endpoints = [
        ("get", "/api/v1/auth/me"),
        ("get", "/api/v1/student/profile"),
        ("post", "/api/v1/student/profile"),
        ("get", "/api/v1/recruiter/profile"),
        ("post", "/api/v1/jobs"),
        ("post", "/api/v1/jobs/{job_id}/applications"),
        ("get", "/api/v1/applications/me"),
        ("post", "/api/v1/jobs/{job_id}/save"),
        ("get", "/api/v1/saved-jobs"),
        ("get", "/api/v1/dashboard/student"),
        ("get", "/api/v1/admin/users"),
        ("get", "/api/v1/notifications"),
        ("get", "/api/v1/conversations"),
    ]
    for method, path in auth_endpoints:
        op = paths.get(path, {}).get(method)
        assert op is not None, f"Endpoint {method.upper()} {path} missing from OpenAPI schema"
        sec = op.get("security", [])
        assert len(sec) > 0, f"Protected endpoint {method.upper()} {path} must have security requirement"
        assert any("HTTPBearer" in s for s in sec), f"HTTPBearer requirement missing on {method.upper()} {path}"


def test_07_request_schemas_present_on_write_endpoints():
    """Verify write endpoints have well-defined requestBody schemas in OpenAPI."""
    schema = app.openapi()
    paths = schema.get("paths", {})

    representative_write_routes = [
        ("post", "/api/v1/auth/login", "LoginRequest"),
        ("post", "/api/v1/users", "UserCreate"),
        ("post", "/api/v1/student/profile", "StudentProfileCreate"),
        ("patch", "/api/v1/student/profile", "StudentProfileUpdate"),
        ("post", "/api/v1/recruiter/profile", "RecruiterProfileCreate"),
        ("post", "/api/v1/jobs", "JobPostingCreate"),
        ("patch", "/api/v1/jobs/{job_id}", "JobPostingUpdate"),
        ("post", "/api/v1/jobs/{job_id}/applications", "ApplicationCreate"),
        ("post", "/api/v1/applications/{application_id}/interviews", "InterviewCreate"),
        ("patch", "/api/v1/interviews/{interview_id}", "InterviewUpdate"),
        ("post", "/api/v1/conversations", "ConversationCreate"),
        ("post", "/api/v1/conversations/{conversation_id}/messages", "MessageCreate"),
    ]

    for method, path, expected_schema_ref in representative_write_routes:
        op = paths.get(path, {}).get(method)
        assert op is not None, f"Endpoint {method.upper()} {path} not found in OpenAPI paths"
        req_body = op.get("requestBody")
        assert req_body is not None, f"Missing requestBody for {method.upper()} {path}"
        content = req_body.get("content", {}).get("application/json", {})
        schema_obj = content.get("schema", {})
        ref = schema_obj.get("$ref", "")
        assert expected_schema_ref in ref, f"Expected schema '{expected_schema_ref}' in requestBody for {method.upper()} {path}, got: {schema_obj}"


def test_08_response_schemas_present_on_endpoints():
    """Verify 200/201 endpoints expose structured response models."""
    schema = app.openapi()
    paths = schema.get("paths", {})

    representative_read_routes = [
        ("get", "/api/v1/auth/me", "UserResponse"),
        ("get", "/api/v1/student/profile", "StudentProfileResponse"),
        ("get", "/api/v1/recruiter/profile", "RecruiterProfileResponse"),
        ("get", "/api/v1/jobs/{job_id}", "JobPostingResponse"),
        ("get", "/api/v1/jobs", "JobPostingPaginationResponse"),
        ("get", "/api/v1/dashboard/student", "StudentDashboardResponse"),
        ("get", "/api/v1/dashboard/recruiter", "RecruiterDashboardResponse"),
        ("get", "/api/v1/dashboard/admin", "AdminDashboardResponse"),
        ("get", "/api/v1/notifications", "NotificationPaginationResponse"),
        ("get", "/api/v1/notifications/unread-count", "NotificationUnreadCountResponse"),
    ]

    for method, path, expected_resp_ref in representative_read_routes:
        op = paths.get(path, {}).get(method)
        assert op is not None, f"Endpoint {method.upper()} {path} not found in OpenAPI paths"
        responses = op.get("responses", {})
        resp_200 = responses.get("200", {})
        content = resp_200.get("content", {}).get("application/json", {})
        schema_obj = content.get("schema", {})
        ref = schema_obj.get("$ref", "")
        assert expected_resp_ref in ref, f"Expected response model '{expected_resp_ref}' on 200 for {method.upper()} {path}, got: {schema_obj}"


def test_09_path_parameters_have_descriptions():
    """Verify all path parameters across all routes have explicit parameter descriptions."""
    schema = app.openapi()
    paths = schema.get("paths", {})

    missing_descriptions = []
    for path, methods in paths.items():
        for method, op in methods.items():
            if method not in ["get", "post", "put", "patch", "delete"]:
                continue
            parameters = op.get("parameters", [])
            for param in parameters:
                if param.get("in") == "path":
                    if not param.get("description"):
                        missing_descriptions.append((method.upper(), path, param.get("name")))

    assert len(missing_descriptions) == 0, f"Found path parameters missing descriptions: {missing_descriptions}"


def test_10_openapi_schema_contains_zero_leaked_secrets():
    """Verify OpenAPI document never leaks secrets, database credentials, or passwords."""
    import json

    schema = app.openapi()
    dump = json.dumps(schema)

    forbidden_patterns = [
        settings.POSTGRES_PASSWORD,
        settings.JWT_SECRET_KEY,
        settings.sync_database_url,
    ]
    if settings.SMTP_PASSWORD:
        forbidden_patterns.append(settings.SMTP_PASSWORD)

    for forbidden in forbidden_patterns:
        if forbidden and len(forbidden) > 2:
            assert forbidden not in dump, f"Secret pattern leaked into OpenAPI specification!"


def main():
    """Execute all API documentation tests sequentially."""
    print("=" * 75)
    print("CAREERBRIDGE SECTION 31: API DOCUMENTATION TEST SUITE")
    print("=" * 75)

    tests = [
        ("test_01_docs_endpoint_returns_200_and_loads_swagger_ui", test_01_docs_endpoint_returns_200_and_loads_swagger_ui),
        ("test_02_openapi_json_endpoint_returns_200_and_valid_json", test_02_openapi_json_endpoint_returns_200_and_valid_json),
        ("test_03_openapi_metadata_title_version_and_description", test_03_openapi_metadata_title_version_and_description),
        ("test_04_openapi_tags_metadata_registered", test_04_openapi_tags_metadata_registered),
        ("test_05_openapi_security_schemes_configured", test_05_openapi_security_schemes_configured),
        ("test_06_authenticated_and_public_endpoints_security_requirements", test_06_authenticated_and_public_endpoints_security_requirements),
        ("test_07_request_schemas_present_on_write_endpoints", test_07_request_schemas_present_on_write_endpoints),
        ("test_08_response_schemas_present_on_endpoints", test_08_response_schemas_present_on_endpoints),
        ("test_09_path_parameters_have_descriptions", test_09_path_parameters_have_descriptions),
        ("test_10_openapi_schema_contains_zero_leaked_secrets", test_10_openapi_schema_contains_zero_leaked_secrets),
    ]

    for idx, (name, fn) in enumerate(tests, 1):
        print(f"[{idx:02d}/{len(tests):02d}] {name}...", end="", flush=True)
        try:
            fn()
            print(" [PASS]")
        except Exception as exc:
            print(f" [FAIL]: {exc}")
            raise

    print("=" * 75)
    print("ALL API DOCUMENTATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 75)


if __name__ == "__main__":
    main()
