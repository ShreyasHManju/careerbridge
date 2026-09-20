import math
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.job_posting import EmploymentType, JobPosting, OpportunityType
from app.models.user import User, UserRole
from app.schemas.job_posting import (
    JobPostingCreate,
    JobPostingPaginationResponse,
    JobPostingResponse,
    JobPostingUpdate,
    JobSortBy,
    SortOrder,
)

router = APIRouter(prefix="/jobs", tags=["Jobs & Internships"])


@router.post(
    "",
    response_model=JobPostingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new job or internship posting",
    description="Allows an authenticated recruiter to post a new job or internship opportunity. Ownership is securely bound to current_user.id.",
)
@router.post(
    "/",
    response_model=JobPostingResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_job_posting(
    payload: JobPostingCreate,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Create a new job posting for the authenticated recruiter.
    Enforces:
    - Recruiter-only access (require_role(UserRole.RECRUITER)).
    - Secure ownership: recruiter_id is derived strictly from current_user.id.
    """
    posting_data = payload.model_dump()
    new_posting = JobPosting(
        recruiter_id=current_user.id,
        **posting_data,
    )
    db.add(new_posting)
    db.commit()
    db.refresh(new_posting)
    return new_posting


@router.get(
    "/my",
    response_model=List[JobPostingResponse],
    summary="List postings owned by authenticated recruiter",
    description="Retrieves all job and internship postings (both active and inactive) created by the currently authenticated recruiter.",
)
def get_my_job_postings(
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Retrieve all postings owned by the authenticated recruiter, newest first.
    Never exposes another recruiter's postings.
    """
    postings = db.scalars(
        select(JobPosting)
        .where(JobPosting.recruiter_id == current_user.id)
        .order_by(JobPosting.created_at.desc())
    ).all()
    return postings


@router.get(
    "",
    response_model=JobPostingPaginationResponse,
    summary="Search, filter, and paginate active job and internship postings",
    description=(
        "Public candidate discovery endpoint. Returns active postings matching search, "
        "filtering, sorting, and pagination parameters. Inactive postings are strictly omitted."
    ),
)
@router.get("/", response_model=JobPostingPaginationResponse, include_in_schema=False)
def browse_active_job_postings(
    q: Optional[str] = Query(
        None,
        description="Search term operating across title, description, company name, location, and skills (case-insensitive)",
    ),
    opportunity_type: Optional[OpportunityType] = Query(
        None,
        description="Filter by opportunity type ('internship' or 'job')",
    ),
    employment_type: Optional[EmploymentType] = Query(
        None,
        description="Filter by employment type ('full_time', 'part_time', 'contract')",
    ),
    is_remote: Optional[bool] = Query(
        None,
        description="Filter by remote work eligibility (true or false)",
    ),
    location: Optional[str] = Query(
        None,
        description="Filter by location (case-insensitive partial match)",
    ),
    skills: Optional[str] = Query(
        None,
        description="Filter by required skills (case-insensitive partial match on skills text)",
    ),
    salary_min: Optional[int] = Query(
        None,
        ge=0,
        description="Filter opportunities satisfying a minimum compensation threshold",
    ),
    salary_max: Optional[int] = Query(
        None,
        ge=0,
        description="Filter opportunities satisfying a maximum compensation threshold",
    ),
    sort_by: JobSortBy = Query(
        JobSortBy.CREATED_AT,
        description="Field to sort by ('created_at', 'application_deadline', 'salary_min')",
    ),
    sort_order: SortOrder = Query(
        SortOrder.DESC,
        description="Sort direction ('asc' or 'desc')",
    ),
    page: int = Query(
        1,
        ge=1,
        description="Page number (1-indexed, minimum: 1)",
    ),
    page_size: int = Query(
        10,
        ge=1,
        le=100,
        description="Number of records per page (minimum: 1, maximum: 100)",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Candidate discovery: Returns active postings matching search, filtering,
    sorting, and pagination criteria. Evaluated entirely in PostgreSQL.
    """
    # Salary range cross-validation
    if salary_min is not None and salary_max is not None and salary_min > salary_max:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="salary_min cannot be greater than salary_max",
        )

    # Base filter: strictly active postings only
    filters = [JobPosting.is_active == True]

    # 1. Search (q) across title, description, company_name, location, skills
    if q and q.strip():
        term = f"%{q.strip()}%"
        filters.append(
            or_(
                JobPosting.title.ilike(term),
                JobPosting.description.ilike(term),
                JobPosting.company_name.ilike(term),
                JobPosting.location.ilike(term),
                JobPosting.skills.ilike(term),
            )
        )

    # 2. Opportunity Type filter
    if opportunity_type is not None:
        filters.append(JobPosting.opportunity_type == opportunity_type)

    # 3. Employment Type filter
    if employment_type is not None:
        filters.append(JobPosting.employment_type == employment_type)

    # 4. Remote status filter
    if is_remote is not None:
        filters.append(JobPosting.is_remote == is_remote)

    # 5. Location filter (case-insensitive partial match)
    if location and location.strip():
        filters.append(JobPosting.location.ilike(f"%{location.strip()}%"))

    # 6. Skills filter (case-insensitive partial match on Text column)
    if skills and skills.strip():
        filters.append(JobPosting.skills.ilike(f"%{skills.strip()}%"))

    # 7. Salary filters (database-side numeric evaluation)
    # Postings without disclosed salary are excluded from explicit numeric salary filters
    if salary_min is not None:
        filters.append(
            and_(
                or_(JobPosting.salary_min.isnot(None), JobPosting.salary_max.isnot(None)),
                func.coalesce(JobPosting.salary_max, JobPosting.salary_min) >= salary_min,
            )
        )

    if salary_max is not None:
        filters.append(
            and_(
                or_(JobPosting.salary_min.isnot(None), JobPosting.salary_max.isnot(None)),
                func.coalesce(JobPosting.salary_min, JobPosting.salary_max) <= salary_max,
            )
        )

    # Total matching records count directly in database
    total = db.scalar(select(func.count(JobPosting.id)).where(*filters)) or 0

    # Sorting
    sort_col_map = {
        JobSortBy.CREATED_AT: JobPosting.created_at,
        JobSortBy.APPLICATION_DEADLINE: JobPosting.application_deadline,
        JobSortBy.SALARY_MIN: JobPosting.salary_min,
    }
    sort_column = sort_col_map[sort_by]
    if sort_order == SortOrder.ASC:
        order_clause = sort_column.asc().nulls_last()
    else:
        order_clause = sort_column.desc().nulls_last()

    # Database-side pagination with OFFSET and LIMIT
    offset = (page - 1) * page_size
    items = db.scalars(
        select(JobPosting)
        .where(*filters)
        .order_by(order_clause, JobPosting.id.desc())
        .offset(offset)
        .limit(page_size)
    ).all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return JobPostingPaginationResponse(
        items=list(items),
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get(
    "/{job_id}",
    response_model=JobPostingResponse,
    summary="Get single job posting details",
    description="Retrieve details of a job posting by ID. Inactive postings are hidden from candidates (404) but accessible to the owning recruiter or admin.",
)
def get_job_posting_by_id(
    job_id: int = Path(..., ge=1, description="Primary key identifier of the job posting"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve single job posting.
    Hides inactive postings from unauthorized candidates by returning 404.
    """
    posting = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
    if not posting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    # Inactive posting visibility guard
    if not posting.is_active:
        is_owner = (
            current_user.role == UserRole.RECRUITER
            and posting.recruiter_id == current_user.id
        )
        is_admin = current_user.role == UserRole.ADMIN
        if not (is_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job posting not found",
            )

    return posting


@router.patch(
    "/{job_id}",
    response_model=JobPostingResponse,
    summary="Update a job posting",
    description="Allows the owning recruiter to partially update a job posting. Rejects attempts by other recruiters (403).",
)
def update_job_posting(
    job_id: int = Path(..., ge=1, description="Primary key identifier of the job posting"),
    payload: JobPostingUpdate = ...,
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Partially update existing job posting.
    Enforces:
    - Posting existence (404).
    - Ownership verification: caller must own posting (403).
    - Ownership immutability: recruiter_id cannot be changed.
    - Cross-field salary integrity check.
    """
    posting = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
    if not posting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    if posting.recruiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to modify this job posting",
        )

    update_data = payload.model_dump(exclude_unset=True)
    # Strictly strip any attempt to modify ownership
    update_data.pop("recruiter_id", None)

    # Cross-field salary consistency check for partial updates
    new_min = update_data.get("salary_min", posting.salary_min)
    new_max = update_data.get("salary_max", posting.salary_max)
    if new_min is not None and new_max is not None and new_max < new_min:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="salary_max cannot be less than salary_min",
        )

    for field, value in update_data.items():
        setattr(posting, field, value)

    db.commit()
    db.refresh(posting)
    return posting


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a job posting",
    description="Allows the owning recruiter to permanently delete a job posting. Rejects attempts by other recruiters (403).",
)
def delete_job_posting(
    job_id: int = Path(..., ge=1, description="Primary key identifier of the job posting"),
    current_user: User = Depends(require_role(UserRole.RECRUITER)),
    db: Session = Depends(get_db),
):
    """
    Delete existing job posting.
    Enforces:
    - Posting existence (404).
    - Ownership verification: caller must own posting (403).
    """
    posting = db.scalar(select(JobPosting).where(JobPosting.id == job_id))
    if not posting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job posting not found",
        )

    if posting.recruiter_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to delete this job posting",
        )

    db.delete(posting)
    db.commit()
    return None
