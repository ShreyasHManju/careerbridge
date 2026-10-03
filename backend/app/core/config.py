from pathlib import Path
from typing import List, Optional, Union
from pydantic import AliasChoices, Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "CareerBridge"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # CORS Configuration
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v.strip():
                return []
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, tuple)):
            return [str(i) for i in v]
        return []

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.BACKEND_CORS_ORIGINS, list):
            return self.BACKEND_CORS_ORIGINS
        return [str(self.BACKEND_CORS_ORIGINS)]

    # Database Configuration (PostgreSQL 16)
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "internship_db"

    # Google Authentication
    GOOGLE_CLIENT_ID: str

    # Security & JWT Configuration
    JWT_SECRET_KEY: str = Field(
        ...,
        validation_alias=AliasChoices("JWT_SECRET_KEY", "SECRET_KEY"),
        description="Secret cryptographic key for signing JWT tokens",
    )
    JWT_ALGORITHM: str = Field(
        default="HS256",
        validation_alias=AliasChoices("JWT_ALGORITHM", "ALGORITHM"),
        description="Algorithm used for signing JWT tokens",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Storage Provider & Upload Configuration (Phase 5.1)
    STORAGE_PROVIDER: str = Field(
        default="local",
        validation_alias=AliasChoices("STORAGE_PROVIDER", "STORAGE_BACKEND"),
        description="Storage provider: 'local' or 's3'",
    )
    STORAGE_BUCKET: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("STORAGE_BUCKET", "S3_BUCKET", "AWS_S3_BUCKET"),
        description="Target S3 / Cloudflare R2 / MinIO bucket name",
    )
    STORAGE_REGION: str = Field(
        default="us-east-1",
        validation_alias=AliasChoices("STORAGE_REGION", "AWS_REGION", "AWS_DEFAULT_REGION"),
        description="Target S3 / Cloudflare R2 region",
    )
    STORAGE_ENDPOINT_URL: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("STORAGE_ENDPOINT_URL", "S3_ENDPOINT_URL"),
        description="Custom endpoint URL for Cloudflare R2 or MinIO",
    )
    AWS_ACCESS_KEY_ID: Optional[str] = Field(
        default=None,
        description="AWS / R2 Access Key ID",
    )
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(
        default=None,
        description="AWS / R2 Secret Access Key",
    )

    UPLOAD_DIR: str = "uploads"
    MAX_RESUME_SIZE_MB: int = Field(
        default=5,
        validation_alias=AliasChoices("MAX_RESUME_SIZE_MB", "MAX_UPLOAD_SIZE_MB"),
        description="Maximum allowed resume file size in megabytes",
    )
    MAX_PROFILE_IMAGE_SIZE_MB: int = Field(
        default=2,
        validation_alias=AliasChoices("MAX_PROFILE_IMAGE_SIZE_MB", "MAX_IMAGE_SIZE_MB"),
        description="Maximum allowed profile image file size in megabytes",
    )

    @property
    def resume_upload_dir(self) -> Path:
        base_dir = Path(__file__).resolve().parent.parent.parent
        upload_path = base_dir / self.UPLOAD_DIR / "resumes"
        upload_path.mkdir(parents=True, exist_ok=True)
        return upload_path

    @property
    def profile_image_upload_dir(self) -> Path:
        base_dir = Path(__file__).resolve().parent.parent.parent
        upload_path = base_dir / self.UPLOAD_DIR / "profile_images"
        upload_path.mkdir(parents=True, exist_ok=True)
        return upload_path

    # Email Notification Configuration
    EMAIL_PROVIDER: str = "local"  # "local" or "smtp"
    EMAIL_FROM: str = "no-reply@careerbridge.io"
    EMAIL_FROM_NAME: str = "CareerBridge"
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True
    FRONTEND_URL: str = "http://localhost:5173"

    # Rate Limiting Configuration
    RATE_LIMIT_LOGIN_ENABLED: bool = True
    RATE_LIMIT_LOGIN_MAX_ATTEMPTS: int = 5
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = 60

    RATE_LIMIT_PASSWORD_RESET_ENABLED: bool = True
    RATE_LIMIT_PASSWORD_RESET_MAX_ATTEMPTS: int = 3
    RATE_LIMIT_PASSWORD_RESET_WINDOW_SECONDS: int = 300

    RATE_LIMIT_MESSAGING_ENABLED: bool = True
    RATE_LIMIT_MESSAGING_MAX_ATTEMPTS: int = 30
    RATE_LIMIT_MESSAGING_WINDOW_SECONDS: int = 60

    RATE_LIMIT_APPLICATION_ENABLED: bool = True
    RATE_LIMIT_APPLICATION_MAX_ATTEMPTS: int = 10
    RATE_LIMIT_APPLICATION_WINDOW_SECONDS: int = 60

    # Optional explicit DATABASE_URL
    DATABASE_URL: Optional[str] = None

    @computed_field
    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL.strip()
            if url.startswith("postgres://"):
                url = f"postgresql://{url[11:]}"
            return url
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

settings = Settings()
