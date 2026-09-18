from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ResumeResponse(BaseModel):
    """
    Public safe metadata schema for a student's resume.
    Excludes server-internal filesystem paths and UUID stored filenames.
    """
    id: int = Field(..., description="Unique resume record ID")
    original_filename: str = Field(..., description="Original uploaded filename")
    content_type: str = Field(..., description="Validated MIME type of the document")
    file_size: int = Field(..., description="File size in bytes")
    created_at: datetime = Field(..., description="Timestamp when resume was first uploaded")
    updated_at: datetime = Field(..., description="Timestamp when resume was last replaced/updated")

    model_config = ConfigDict(from_attributes=True)
