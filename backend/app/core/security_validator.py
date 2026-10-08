"""
CareerBridge - Production Configuration Security Gate
Validates security invariants when ENVIRONMENT == "production".
Ensures secrets, debug flags, CORS origins, storage providers, and database
credentials meet production hardening standards before application startup.
"""

from typing import List, Optional
from urllib.parse import urlparse

from app.core.config import Settings


class ProductionConfigurationError(ValueError):
    """Raised when application startup encounters unsafe configuration in production environment."""
    pass


# Blacklist of known weak, default, or repository placeholder secrets
WEAK_OR_PLACEHOLDER_JWT_SECRETS = {
    "secret",
    "secretkey",
    "secret_key",
    "changeme",
    "change_me",
    "password",
    "123456",
    "12345678",
    "testsecret",
    "test_secret",
    "careerbridge_secret",
    "careerbridge_jwt_secret_key_production_super_secure",
    "change_this_to_a_super_secret_key_in_production",
    "replace_with_a_secure_random_hex_key_at_least_32_characters_long",
    "your_jwt_secret_key_here",
    "your_secret_key_here",
    "your_jwt_secret_here",
    "your-secret-key-here",
    "your-jwt-secret-key-here",
    "admin",
    "jwt_secret",
    "supersecret",
}

# Blacklist of known placeholder or weak database passwords
WEAK_OR_PLACEHOLDER_DB_PASSWORDS = {
    "replace_with_a_strong_database_password",
    "your_secure_password_here",
    "your_actual_password",
    "your_generated_db_password",
    "your_db_password_here",
    "postgres",
    "password",
    "admin",
    "123456",
    "12345678",
    "secret",
    "changeme",
    "root",
    "test",
}


def _validate_debug_mode(settings: Settings, errors: List[str]) -> None:
    if settings.DEBUG is True:
        errors.append("DEBUG mode must be False in production.")


def _validate_jwt_secret(settings: Settings, errors: List[str]) -> None:
    jwt_secret = settings.JWT_SECRET_KEY
    if not jwt_secret or not str(jwt_secret).strip():
        errors.append("JWT_SECRET_KEY is missing or empty in production.")
        return

    secret_str = str(jwt_secret).strip()
    if len(secret_str) < 32:
        errors.append("JWT_SECRET_KEY must be at least 32 characters in production.")
        return

    normalized = secret_str.lower()
    if normalized in WEAK_OR_PLACEHOLDER_JWT_SECRETS:
        errors.append(
            "JWT_SECRET_KEY matches a known weak, default, or example placeholder in production."
        )
        return

    # Check if known placeholder substring is contained
    for placeholder in [
        "replace_with_a_secure_random_hex",
        "change_this_to_a_super_secret_key",
        "your_jwt_secret_key_here",
        "your_secret_key_here",
    ]:
        if placeholder in normalized:
            errors.append(
                "JWT_SECRET_KEY matches a known weak, default, or example placeholder in production."
            )
            return


def _validate_cors_origins(settings: Settings, errors: List[str]) -> None:
    origins = settings.cors_origins_list
    if not origins:
        errors.append("CORS origins are empty; at least one valid HTTP/HTTPS origin is required in production.")
        return

    has_wildcard = False
    has_malformed = False

    for origin in origins:
        origin_clean = origin.strip()
        if not origin_clean:
            continue

        if origin_clean == "*" or "*" in origin_clean:
            has_wildcard = True

        try:
            parsed = urlparse(origin_clean)
            if parsed.scheme.lower() not in ("http", "https"):
                has_malformed = True
            elif not parsed.netloc:
                has_malformed = True
        except Exception:
            has_malformed = True

    if has_wildcard:
        errors.append(
            "CORS configuration contains wildcard '*' origins which are prohibited in production when credentials are enabled."
        )

    if has_malformed:
        errors.append(
            "CORS configuration contains malformed or non-HTTP/HTTPS origins in production."
        )


def _validate_storage_provider(settings: Settings, errors: List[str]) -> None:
    provider = (settings.STORAGE_PROVIDER or "").strip().lower()
    if provider == "s3":
        bucket = (settings.STORAGE_BUCKET or "").strip()
        if not bucket:
            errors.append("STORAGE_BUCKET must be configured and non-empty when STORAGE_PROVIDER is 's3' in production.")
    elif provider == "local":
        upload_dir = (settings.UPLOAD_DIR or "").strip()
        if not upload_dir:
            errors.append("UPLOAD_DIR must be configured and non-empty when STORAGE_PROVIDER is 'local' in production.")
        elif "\x00" in upload_dir:
            errors.append("UPLOAD_DIR contains invalid characters in production.")
    else:
        errors.append(
            f"STORAGE_PROVIDER must be 's3' or 'local' in production (configured provider: '{provider or 'none'}')."
        )


def _validate_database_credentials(settings: Settings, errors: List[str]) -> None:
    # Check explicit DATABASE_URL if present
    if settings.DATABASE_URL and settings.DATABASE_URL.strip():
        url_str = settings.DATABASE_URL.strip()
        try:
            # Normalize postgres:// to postgresql:// for standard urllib parsing
            if url_str.startswith("postgres://"):
                url_str = f"postgresql://{url_str[11:]}"
            parsed = urlparse(url_str)
            db_password = parsed.password
            if not db_password or not db_password.strip():
                errors.append("DATABASE_URL must contain a non-empty password in production.")
            elif db_password.strip().lower() in WEAK_OR_PLACEHOLDER_DB_PASSWORDS:
                errors.append(
                    "DATABASE_URL contains a known weak, default, or example placeholder password in production."
                )
        except Exception:
            errors.append("DATABASE_URL is malformed in production.")
        return

    # Check individual POSTGRES_PASSWORD
    db_password = (settings.POSTGRES_PASSWORD or "").strip()
    if not db_password:
        errors.append("POSTGRES_PASSWORD must be configured and non-empty in production.")
        return

    if db_password.lower() in WEAK_OR_PLACEHOLDER_DB_PASSWORDS:
        errors.append(
            "POSTGRES_PASSWORD matches a known weak, default, or example placeholder in production."
        )


def validate_production_configuration(settings: Settings) -> List[str]:
    """
    Validates configuration invariants for production deployments.
    Returns a list of error messages describing configuration failures.
    Returns an empty list if configuration is valid or if ENVIRONMENT != 'production'.
    Does not perform network calls or external I/O.
    Guarantees no secrets are present in returned error messages.
    """
    env = (settings.ENVIRONMENT or "").strip().lower()
    if env != "production":
        return []

    errors: List[str] = []

    _validate_debug_mode(settings, errors)
    _validate_jwt_secret(settings, errors)
    _validate_cors_origins(settings, errors)
    _validate_storage_provider(settings, errors)
    _validate_database_credentials(settings, errors)

    return errors


def assert_production_configuration_or_fail(settings: Optional[Settings] = None) -> None:
    """
    Asserts that application configuration is safe for production.
    Raises ProductionConfigurationError if validation fails.
    """
    if settings is None:
        from app.core.config import settings as app_settings
        settings = app_settings

    errors = validate_production_configuration(settings)
    if errors:
        error_details = "\n  - ".join(errors)
        raise ProductionConfigurationError(
            f"Production security configuration validation failed with {len(errors)} error(s):\n  - {error_details}"
        )
