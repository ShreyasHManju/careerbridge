from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Path, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.email_service import EmailService

router = APIRouter(prefix="/users", tags=["Users"])


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description="Creates a new user record. Plaintext password is safe-hashed before storage.",
)
def create_user(
    payload: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{payload.email}' already exists.",
        )

    hashed_pwd = hash_password(payload.password)
    new_user = User(
        email=payload.email,
        password_hash=hashed_pwd,
        role=payload.role,
    )
    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{payload.email}' already exists.",
        )

    role_str = new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role)
    EmailService.dispatch_welcome_email(
        to_email=new_user.email,
        role=role_str,
        user_name=new_user.email.split("@")[0],
        background_tasks=background_tasks,
    )

    return new_user



@router.get(
    "",
    response_model=List[UserResponse],
    summary="List users",
    description="Retrieve a paginated list of users.",
)
def list_users(
    skip: int = Query(0, ge=0, description="Number of user records to skip (offset)"),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of user records to return (limit)"),
    db: Session = Depends(get_db),
):
    query = select(User).offset(skip).limit(limit).order_by(User.id.asc())
    return db.scalars(query).all()


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    description="Retrieve a single user by its primary key ID.",
)
def get_user(
    user_id: int = Path(..., ge=1, description="Primary key identifier of the user record"),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )
    return user


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update user",
    description="Partially update an existing user's attributes.",
)
def update_user(
    user_id: int = Path(..., ge=1, description="Primary key identifier of the user record"),
    payload: UserUpdate = ...,
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return user

    if "email" in update_data and update_data["email"] != user.email:
        email_collision = db.scalar(
            select(User).where(
                User.email == update_data["email"], User.id != user_id
            )
        )
        if email_collision:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{update_data['email']}' is already in use by another account.",
            )

    for field, value in update_data.items():
        setattr(user, field, value)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Database integrity conflict occurred while updating user.",
        )
    return user


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user",
    description="Delete an existing user by ID.",
)
def delete_user(
    user_id: int = Path(..., ge=1, description="Primary key identifier of the user record"),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found.",
        )
    db.delete(user)
    db.commit()
    return None
