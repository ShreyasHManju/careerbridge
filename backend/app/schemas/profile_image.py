from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ProfileImageResponse(BaseModel):
    """
    Public safe metadata schema for a student's profile image.
    Excludes server-internal filesystem paths and UUID stored filenames.
    """
    id: int = Field(..., description="Unique profile image record ID")
    original_filename: str = Field(..., description="Original uploaded filename")
    content_type: str = Field(..., description="Validated MIME type of the image")
    file_size: int = Field(..., description="File size in bytes")
    created_at: datetime = Field(..., description="Timestamp when profile image was first uploaded")
    updated_at: datetime = Field(..., description="Timestamp when profile image was last replaced/updated")

    model_config = ConfigDict(from_attributes=True)
