import pytest

from app.core.test_fixtures import clean_test_records, get_test_db
from app.models.user import User


@pytest.fixture(autouse=True)
def cleanup_core_roadmap_test_data(request):
    yield

    if request.node.module.__name__ != "test_core_roadmap":
        return

    with get_test_db() as db:
        patterns = [
            "reg_%@careerbridge.io",
            "login_%@careerbridge.io",
            "perm_%@careerbridge.io",
            "job_create_%@careerbridge.io",
            "filter_%@careerbridge.io",
            "app_%@careerbridge.io",
            "dup_%@careerbridge.io",
            "stat_%@careerbridge.io",
            "adm_%@careerbridge.io",
            "err_%@careerbridge.io",
            "short_pass_%@careerbridge.io",
            "e2e_student_%@careerbridge.io",
            "e2e_recruiter_%@careerbridge.io",
        ]

        user_ids = set()

        for pattern in patterns:
            rows = (
                db.query(User.id)
                .filter(User.email.like(pattern))
                .all()
            )
            user_ids.update(row[0] for row in rows)

        if user_ids:
            clean_test_records(db, user_ids=list(user_ids))
