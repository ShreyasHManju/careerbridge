import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.schema import CreateTable
from app.core.database import engine
from app.models import Base, User, UserRole


def test_user_model_metadata():
    print("[1/6] Verifying User model import and table name")
    assert User.__tablename__ == "users"
    assert "users" in Base.metadata.tables
    table = Base.metadata.tables["users"]
    print("  -> User model mapped to table 'users'.")


    print("[2/6] Verifying required columns and data types")
    expected_columns = {
        "id": Integer,
        "email": String,
        "password_hash": String,
        "role": None,
        "is_active": Boolean,
        "is_verified": Boolean,
        "created_at": DateTime,
        "updated_at": DateTime,
    }
    column_names = set(table.columns.keys())
    assert set(expected_columns.keys()).issubset(column_names), f"Missing columns! Found: {column_names}"
    for col_name, expected_type in expected_columns.items():
        assert col_name in table.columns, f"Column '{col_name}' missing"
        if expected_type:
            assert isinstance(table.columns[col_name].type, expected_type), f"Column '{col_name}' type mismatch"
    print(f"  -> All {len(expected_columns)} columns verified with correct types.")


    print("[3/6] Verifying primary key and constraints")
    assert table.c.id.primary_key is True, "id must be primary key"
    assert table.c.email.unique is True, "email must have unique constraint"
    assert table.c.email.index is True, "email must be indexed"
    assert table.c.email.nullable is False, "email must not be nullable"
    assert table.c.password_hash.nullable is False, "password_hash must not be nullable"
    print("  -> Primary key (id) and unique index (email) verified.")


    print("[4/6] Verifying role enum and supported values")
    assert UserRole.STUDENT.value == "student"
    assert UserRole.RECRUITER.value == "recruiter"
    assert UserRole.ADMIN.value == "admin"
    assert table.c.role.nullable is False, "role must not be nullable"
    assert table.c.role.default.arg == UserRole.STUDENT, "role default must be student"
    print("  -> Roles verified: ['student', 'recruiter', 'admin'] (default: 'student').")


    print("[5/6] Verifying boolean flags and timestamp defaults")
    assert table.c.is_active.default.arg is True, "is_active must default to True"
    assert table.c.is_verified.default.arg is False, "is_verified must default to False"
    assert table.c.created_at.server_default is not None, "created_at must have server_default"
    assert table.c.updated_at.onupdate is not None, "updated_at must have onupdate"
    print("  -> Flags and timestamps (server_default & onupdate) verified.")


    print("[6/6] Verifying PostgreSQL 16 DDL compilation against engine")
    ddl = CreateTable(table).compile(engine)
    ddl_str = str(ddl).strip()
    assert "CREATE TABLE users" in ddl_str
    assert "email VARCHAR(255)" in ddl_str
    assert "password_hash VARCHAR(255)" in ddl_str
    print("  -> Generated PostgreSQL DDL successfully:\n")
    for line in ddl_str.splitlines():
        print(f"     {line}")


    print("\n==========================================================")
    print("ALL PHASE#3 USER MODEL METADATA TESTS PASSED SUCCESSFULLY!")
    print("=========================================================\n")


if __name__ == "__main__":
    test_user_model_metadata()
