"""
Unit and integration tests for the Production Configuration Security Gate.
Verifies strict blocking of unsafe production settings, isolation of development/test
environments, and absolute prevention of secret leakage in error messages.
"""

import pytest
from starlette.testclient import TestClient

from app.core.config import Settings
from app.core.security_validator import (
    ProductionConfigurationError,
    assert_production_configuration_or_fail,
    validate_production_configuration,
)
from app.main import app


def create_valid_production_settings(**overrides) -> Settings:
    """Helper creating a guaranteed-valid production Settings instance in isolation."""
    defaults = {
        "ENVIRONMENT": "production",
        "DEBUG": False,
        "JWT_SECRET_KEY": "a" * 64,  # Strong 64-char secret
        "JWT_ALGORITHM": "HS256",
        "GOOGLE_CLIENT_ID": "prod-client-id.apps.googleusercontent.com",
        "POSTGRES_USER": "prod_db_user",
        "POSTGRES_PASSWORD": "ValidStrongProductionPassword123!#$",
        "POSTGRES_HOST": "prod-db.internal",
        "POSTGRES_PORT": 5432,
        "POSTGRES_DB": "careerbridge_prod",
        "DATABASE_URL": None,
        "BACKEND_CORS_ORIGINS": ["https://careerbridge.example.com", "https://app.careerbridge.example.com"],
        "STORAGE_PROVIDER": "s3",
        "STORAGE_BUCKET": "careerbridge-prod-assets",
        "STORAGE_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": None,  # IAM role authentication
        "AWS_SECRET_ACCESS_KEY": None,
    }
    defaults.update(overrides)
    return Settings(_env_file=None, **defaults)


# ==============================================================================
# 1. VALID PRODUCTION CONFIGURATION TESTS
# ==============================================================================

def test_valid_production_configuration_passes():
    """Valid production configuration with high-entropy keys and S3 passes without errors."""
    settings = create_valid_production_settings()
    errors = validate_production_configuration(settings)
    assert errors == []
    # Assert function must not raise
    assert_production_configuration_or_fail(settings)


def test_valid_production_with_explicit_database_url_passes():
    """Valid production configuration with secure DATABASE_URL passes."""
    settings = create_valid_production_settings(
        DATABASE_URL="postgresql://prod_user:StrongSecretPass987@db.example.com:5432/careerbridge_prod"
    )
    errors = validate_production_configuration(settings)
    assert errors == []
    assert_production_configuration_or_fail(settings)


def test_valid_production_iam_role_without_static_aws_keys():
    """AWS IAM role authentication without static AWS_ACCESS_KEY_ID/SECRET is valid."""
    settings = create_valid_production_settings(
        AWS_ACCESS_KEY_ID=None,
        AWS_SECRET_ACCESS_KEY=None,
    )
    errors = validate_production_configuration(settings)
    assert errors == []


# ==============================================================================
# 2. DEBUG MODE REJECTION IN PRODUCTION
# ==============================================================================

def test_production_rejects_debug_true():
    """Production startup must fail if DEBUG is True."""
    settings = create_valid_production_settings(DEBUG=True)
    errors = validate_production_configuration(settings)
    assert any("DEBUG mode must be False" in err for err in errors)
    with pytest.raises(ProductionConfigurationError) as exc_info:
        assert_production_configuration_or_fail(settings)
    assert "DEBUG mode must be False" in str(exc_info.value)


# ==============================================================================
# 3. JWT SECRET VALIDATION IN PRODUCTION
# ==============================================================================

def test_production_rejects_empty_jwt_secret():
    """Production startup must fail if JWT_SECRET_KEY is empty."""
    settings = create_valid_production_settings(JWT_SECRET_KEY="   ")
    errors = validate_production_configuration(settings)
    assert any("JWT_SECRET_KEY is missing or empty" in err for err in errors)


def test_production_rejects_short_jwt_secret():
    """Production startup must fail if JWT_SECRET_KEY is shorter than 32 characters."""
    settings = create_valid_production_settings(JWT_SECRET_KEY="short-secret-key-12345")
    errors = validate_production_configuration(settings)
    assert any("must be at least 32 characters" in err for err in errors)


@pytest.mark.parametrize(
    "weak_secret",
    [
        "secret",
        "secretkey",
        "changeme",
        "password",
        "123456",
        "12345678",
        "testsecret",
        "replace_with_a_secure_random_hex_key_at_least_32_characters_long",
        "change_this_to_a_super_secret_key_in_production",
        "your_jwt_secret_key_here",
        "your_secret_key_here",
        "careerbridge_secret",
    ],
)
def test_production_rejects_known_weak_or_placeholder_jwt_secret(weak_secret: str):
    """Production startup must fail if JWT_SECRET_KEY matches a known weak value or example placeholder."""
    settings = create_valid_production_settings(JWT_SECRET_KEY=weak_secret)
    errors = validate_production_configuration(settings)
    assert any(
        ("known weak, default, or example placeholder" in err) or ("at least 32 characters" in err)
        for err in errors
    )


# ==============================================================================
# 4. CORS ORIGIN VALIDATION IN PRODUCTION
# ==============================================================================

def test_production_rejects_empty_cors_origins():
    """Production startup must fail if CORS origins list is empty."""
    settings = create_valid_production_settings(BACKEND_CORS_ORIGINS=[])
    errors = validate_production_configuration(settings)
    assert any("CORS origins are empty" in err for err in errors)


def test_production_rejects_wildcard_cors_origin():
    """Production startup must fail if CORS origins contain '*' when credentials are enabled."""
    settings = create_valid_production_settings(BACKEND_CORS_ORIGINS=["*"])
    errors = validate_production_configuration(settings)
    assert any("wildcard '*'" in err for err in errors)


def test_production_rejects_malformed_cors_origin():
    """Production startup must fail if CORS origin is malformed or missing scheme."""
    settings = create_valid_production_settings(BACKEND_CORS_ORIGINS=["not-a-valid-origin"])
    errors = validate_production_configuration(settings)
    assert any("malformed or non-HTTP/HTTPS" in err for err in errors)


def test_production_rejects_non_http_cors_origin():
    """Production startup must fail if CORS origin uses a non-HTTP/HTTPS protocol."""
    settings = create_valid_production_settings(BACKEND_CORS_ORIGINS=["ftp://example.com"])
    errors = validate_production_configuration(settings)
    assert any("malformed or non-HTTP/HTTPS" in err for err in errors)


# ==============================================================================
# 5. STORAGE PROVIDER VALIDATION IN PRODUCTION
# ==============================================================================

def test_production_allows_valid_local_storage_provider():
    """Production startup succeeds with STORAGE_PROVIDER='local' and valid UPLOAD_DIR."""
    settings = create_valid_production_settings(STORAGE_PROVIDER="local", UPLOAD_DIR="uploads")
    errors = validate_production_configuration(settings)
    assert errors == []
    assert_production_configuration_or_fail(settings)


def test_production_rejects_empty_upload_dir_with_local_storage():
    """Production startup must fail if STORAGE_PROVIDER is 'local' but UPLOAD_DIR is empty."""
    settings = create_valid_production_settings(STORAGE_PROVIDER="local", UPLOAD_DIR="   ")
    errors = validate_production_configuration(settings)
    assert any("UPLOAD_DIR must be configured" in err for err in errors)


def test_production_rejects_unsupported_storage_provider():
    """Production startup must fail if STORAGE_PROVIDER is unsupported (neither 's3' nor 'local')."""
    settings = create_valid_production_settings(STORAGE_PROVIDER="azure_blob")
    errors = validate_production_configuration(settings)
    assert any("STORAGE_PROVIDER must be 's3' or 'local' in production" in err for err in errors)


def test_production_rejects_s3_storage_without_bucket():
    """Production startup must fail if STORAGE_PROVIDER is 's3' but STORAGE_BUCKET is missing."""
    settings = create_valid_production_settings(STORAGE_PROVIDER="s3", STORAGE_BUCKET=None)
    errors = validate_production_configuration(settings)
    assert any("STORAGE_BUCKET must be configured" in err for err in errors)


def test_production_rejects_s3_storage_with_empty_bucket():
    """Production startup must fail if STORAGE_BUCKET is empty string."""
    settings = create_valid_production_settings(STORAGE_PROVIDER="s3", STORAGE_BUCKET="   ")
    errors = validate_production_configuration(settings)
    assert any("STORAGE_BUCKET must be configured" in err for err in errors)


# ==============================================================================
# 6. DATABASE CREDENTIALS VALIDATION IN PRODUCTION
# ==============================================================================

@pytest.mark.parametrize(
    "weak_password",
    [
        "replace_with_a_strong_database_password",
        "your_secure_password_here",
        "your_actual_password",
        "postgres",
        "password",
        "admin",
        "123456",
        "secret",
        "changeme",
    ],
)
def test_production_rejects_placeholder_database_password(weak_password: str):
    """Production startup must fail if POSTGRES_PASSWORD matches example placeholders."""
    settings = create_valid_production_settings(POSTGRES_PASSWORD=weak_password)
    errors = validate_production_configuration(settings)
    assert any("POSTGRES_PASSWORD matches a known weak" in err for err in errors)


def test_production_rejects_empty_database_password():
    """Production startup must fail if POSTGRES_PASSWORD is empty."""
    settings = create_valid_production_settings(POSTGRES_PASSWORD="   ")
    errors = validate_production_configuration(settings)
    assert any("POSTGRES_PASSWORD must be configured" in err for err in errors)


def test_production_rejects_placeholder_in_database_url():
    """Production startup must fail if DATABASE_URL contains example placeholder password."""
    settings = create_valid_production_settings(
        DATABASE_URL="postgresql://postgres:replace_with_a_strong_database_password@prod-db:5432/careerbridge"
    )
    errors = validate_production_configuration(settings)
    assert any("DATABASE_URL contains a known weak" in err for err in errors)


# ==============================================================================
# 7. ENVIRONMENT ISOLATION (DEVELOPMENT & TEST WORKFLOWS)
# ==============================================================================

def test_development_environment_allows_local_configuration():
    """Development environment permits local storage, DEBUG=True, and default development passwords."""
    dev_settings = Settings(
        _env_file=None,
        ENVIRONMENT="development",
        DEBUG=True,
        JWT_SECRET_KEY="secret",
        POSTGRES_USER="postgres",
        POSTGRES_PASSWORD="your_secure_password_here",
        GOOGLE_CLIENT_ID="dev-client-id",
        STORAGE_PROVIDER="local",
        BACKEND_CORS_ORIGINS=["http://localhost:5173"],
    )
    errors = validate_production_configuration(dev_settings)
    assert errors == []
    # Must not raise
    assert_production_configuration_or_fail(dev_settings)


def test_test_environment_allows_testing_configuration():
    """Test environment permits test database URLs and short test secrets."""
    test_settings = Settings(
        _env_file=None,
        ENVIRONMENT="test",
        DEBUG=False,
        JWT_SECRET_KEY="testsecret",
        POSTGRES_USER="postgres",
        POSTGRES_PASSWORD="p",
        GOOGLE_CLIENT_ID="test-client-id",
        STORAGE_PROVIDER="local",
        BACKEND_CORS_ORIGINS=["http://testserver"],
    )
    errors = validate_production_configuration(test_settings)
    assert errors == []
    assert_production_configuration_or_fail(test_settings)


# ==============================================================================
# 8. SECRET LEAKAGE PREVENTION TEST
# ==============================================================================

def test_validator_errors_do_not_leak_secrets():
    """
    Explicitly assert that error messages and exception details NEVER contain
    actual passwords, JWT keys, AWS secrets, or complete connection URLs.
    """
    sens_jwt = "SUPER_SECRET_JWT_KEY_VERY_SECRET_DO_NOT_LEAK"
    sens_db_pass = "replace_with_a_strong_database_password"
    sens_aws_key = "AKIA_VERY_SENSITIVE_KEY_12345"
    sens_aws_secret = "AWS_SECRET_KEY_VERY_CONFIDENTIAL_XYZ"
    sens_db_url = f"postgresql://appuser:{sens_db_pass}@production-db.internal:5432/proddb"

    settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        DEBUG=True,
        JWT_SECRET_KEY="secret",  # Known weak
        POSTGRES_USER="postgres",
        POSTGRES_PASSWORD=sens_db_pass,
        GOOGLE_CLIENT_ID="client-id",
        DATABASE_URL=sens_db_url,
        STORAGE_PROVIDER="local",
        STORAGE_BUCKET=None,
        AWS_ACCESS_KEY_ID=sens_aws_key,
        AWS_SECRET_ACCESS_KEY=sens_aws_secret,
        BACKEND_CORS_ORIGINS=["*"],
    )

    errors = validate_production_configuration(settings)
    assert len(errors) > 0

    all_error_text = " ".join(errors)

    # Assert none of the sensitive values are leaked into error messages
    assert sens_jwt not in all_error_text
    assert sens_db_pass not in all_error_text
    assert sens_aws_key not in all_error_text
    assert sens_aws_secret not in all_error_text
    assert sens_db_url not in all_error_text

    # Check exception message
    with pytest.raises(ProductionConfigurationError) as exc_info:
        assert_production_configuration_or_fail(settings)

    exc_text = str(exc_info.value)
    assert sens_jwt not in exc_text
    assert sens_db_pass not in exc_text
    assert sens_aws_key not in exc_text
    assert sens_aws_secret not in exc_text
    assert sens_db_url not in exc_text


# ==============================================================================
# 9. FASTAPI LIFESPAN & APPLICATION STARTUP TEST
# ==============================================================================

def test_fastapi_lifespan_starts_normally_in_development():
    """FastAPI TestClient with development settings starts cleanly."""
    with TestClient(app) as client:
        response = client.get("/health/live")
        assert response.status_code == 200
        assert response.json() == {"status": "alive"}


def test_fastapi_lifespan_blocks_unsafe_production(monkeypatch):
    """FastAPI lifespan execution fails when production configuration is unsafe."""
    monkeypatch.setattr("app.core.config.settings.ENVIRONMENT", "production")
    monkeypatch.setattr("app.core.config.settings.DEBUG", True)
    monkeypatch.setattr("app.core.config.settings.STORAGE_PROVIDER", "local")

    with pytest.raises(ProductionConfigurationError):
        with TestClient(app):
            pass
