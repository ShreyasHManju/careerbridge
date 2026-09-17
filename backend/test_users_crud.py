from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient
from sqlalchemy import select, text
from app.core.database import engine
from app.main import app

_emails_to_clean = set()


def cleanup_db():
    if not _emails_to_clean:
        return
    with engine.connect() as conn:
        for email in _emails_to_clean:
            conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})
        conn.commit()


def test_user_crud():
    client = TestClient(app)
    print("\n==========================================================")
    print("STARTING PHASE 5 USER CRUD API TESTS...")
    print("=========================================================\n")

    test_email = "test.student@careerbridge.io"
    dup_email = "test.dup@careerbridge.io"
    _emails_to_clean.update([test_email, dup_email, "test.pagination1@careerbridge.io", "test.pagination2@careerbridge.io"])
    cleanup_db()

    try:
        print("[1/14] Test: Create User (POST /api/v1/users)")
        res_create = client.post(
            "/api/v1/users",
            json={"email": test_email, "password": "SecurePass123!", "role": "student"},
        )
        assert res_create.status_code == 201, f"Create failed: {res_create.text}"
        user_data = res_create.json()
        user_id = user_data["id"]
        assert user_data["email"] == test_email
        assert user_data["role"] == "student"
        assert user_data["is_active"] is True
        assert user_data["is_verified"] is False
        print(f"  -> Successfully created user ID +{user_id}")


        print("[2/14] Test: Response does not expose password")
        assert "password" not in user_data

        print("[3/14] Test: Response does not expose password_hash")
        assert "password_hash" not in user_data
        print("  -> Confirmed: no password or password_hash in response!")


        print("[4/14] Test: Invalid email is rejected via 422")
        res_inv_email = client.post(
            "/api/v1/users",
            json={"email": "invalid-email-format", "password": "SecurePass123!"},
        )
        assert res_inv_email.status_code == 422
        print("  -> Invalid email rejected with 422 Unprocessable Entity.")


        print("[5/14] Test: Invalid role is rejected via 422")
        res_inv_role = client.post(
            "/api/v1/users",
            json={"email": "invalid.role@example.com", "password": "SecurePass123!", "role": "invalid_role"},
        )
        assert res_inv_role.status_code == 422
        print("  -> Invalid role rejected with 422 Unprocessable Entity.")


        print("[6/14] Test: Duplicate email is rejected via 409")
        res_dup = client.post(
            "/api/v1/users",
            json={"email": test_email, "password": "AnotherPassword123!"},
        )
        assert res_dup.status_code == 409, f"Expected 409, got: {res_dup.status_code}"
        print("  -> Duplicate email caught with 409 Conflict.")


        print("[7/14] Test: Get single user")
        res_get = client.get(f"/api/v1/users/{user_id}")
        assert res_get.status_code == 200
        assert res_get.json()["email"] == test_email


        print("[8/14] Test: Get non-existent user returns 404")
        res_notfound = client.get("/api/v1/users/999999")
        assert res_notfound.status_code == 404


        print("[9/14] Test: Update user (PATCH /api/v1/users/{id})")
        res_update = client.patch(
            f"/api/v1/users/{user_id}",
            json={"role": "recruiter", "is_verified": True},
        )
        assert res_update.status_code == 200
        updated_data = res_update.json()
        assert updated_data["role"] == "recruiter"
        assert updated_data["is_verified"] is True
        assert updated_data["email"] == test_email


        print("[10/14] Test: Partial update (is_active=False)")
        res_partial = client.patch(
            f"/api/v1/users/{user_id}",
            json={"is_active": False},
        )
        assert res_partial.status_code == 200
        assert res_partial.json()["is_active"] is False
        assert res_partial.json()["role"] == "recruiter"


        print("[11/14] Test: Pagination listing")
        client.post("/api/v1/users", json={"email": "test.pagination1@careerbridge.io", "password": "Password123!"})
        client.post("/api/v1/users", json={"email": "test.pagination2@careerbridge.io", "password": "Password123!"})
        res_page = client.get("/api/v1/users?skip=0&limit=1")
        assert res_page.status_code == 200
        assert len(res_page.json()) == 1, f"Expected 1 user, got {len(res_page.json())}"


        print("[12/14] Test: Delete non-existent user returns 404")
        res_del_notfound = client.delete("/api/v1/users/999999")
        assert res_del_notfound.status_code == 404


        print("[13/14] Test: Delete user (DELETE /api/v1/users/{id})")
        res_del = client.delete(f"/api/v1/users/{user_id}")
        assert res_del.status_code == 204


        print("[14/14] Test: Confirm user was deleted")
        res_get_after_del = client.get(f"/api/v1/users/{user_id}")
        assert res_get_after_del.status_code == 404

        print("\n=========================================================")
        print("ALLL +14 USER CRUD API TESTS PASSED SUCCESSFULLY!")
        print("========================================================\n")

    finally:
        cleanup_db()


if __name__ == "__main__":
    test_user_crud()
