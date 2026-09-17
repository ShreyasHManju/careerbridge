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
