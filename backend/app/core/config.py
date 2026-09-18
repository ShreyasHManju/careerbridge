from pathlib import Path
from typing import Optional
from pydantic import AliasChoices, Field, computed_field
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

    # Database Configuration (PostgreSQL 16)
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "internship_db"

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

    # Document & Resume Upload Configuration
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

    # Optional explicit DATABASE_URL
    DATABASE_URL: Optional[str] = None

    @computed_field
    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL: return self.DATABASE_URL
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

settings = Settings()
