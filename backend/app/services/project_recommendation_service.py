from typing import Dict, List, Optional, Set
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.innovation_project import InnovationProject, ProjectStatus
from app.models.project_blueprint import (
    BlueprintDifficulty,
    BlueprintStatus,
    ProjectBlueprint,
    ProjectBlueprintMilestone,
    ProjectBlueprintSkill,
)
from app.models.skill import Skill
from app.schemas.project_blueprint import (
    BlueprintMilestoneResponse,
    BlueprintRecommendationItem,
    BlueprintSkillResponse,
    MatchedMissingSkillItem,
    ProjectBlueprintDetailResponse,
    ProjectBlueprintSummaryResponse,
)


DIFFICULTY_RANK: Dict[str, int] = {
    BlueprintDifficulty.BEGINNER.value: 1,
    BlueprintDifficulty.INTERMEDIATE.value: 2,
    BlueprintDifficulty.ADVANCED.value: 3,
    "beginner": 1,
    "intermediate": 2,
    "advanced": 3,
}


def serialize_blueprint_summary(bp: ProjectBlueprint) -> ProjectBlueprintSummaryResponse:
    skills: List[BlueprintSkillResponse] = []
    for bs in bp.blueprint_skills:
        if bs.skill:
            skills.append(
                BlueprintSkillResponse(
                    id=bs.id,
                    skill_id=bs.skill_id,
                    name=bs.skill.name,
                    slug=bs.skill.slug,
                    category=bs.skill.category,
                    is_primary=bool(bs.is_primary),
                )
            )

    return ProjectBlueprintSummaryResponse(
        id=bp.id,
        title=bp.title,
        slug=bp.slug,
        version=bp.version,
        summary=bp.summary,
        project_type=bp.project_type.value if hasattr(bp.project_type, "value") else str(bp.project_type),
        difficulty_level=bp.difficulty_level.value if hasattr(bp.difficulty_level, "value") else str(bp.difficulty_level),
        estimated_hours=bp.estimated_hours,
        status=bp.status.value if hasattr(bp.status, "value") else str(bp.status),
        skills=skills,
        milestones_count=len(bp.milestones) if bp.milestones else 0,
        created_at=bp.created_at,
        updated_at=bp.updated_at,
    )


def serialize_blueprint_detail(bp: ProjectBlueprint) -> ProjectBlueprintDetailResponse:
    summary = serialize_blueprint_summary(bp)
    milestones: List[BlueprintMilestoneResponse] = []
    for bm in bp.milestones:
        milestones.append(
            BlueprintMilestoneResponse(
                id=bm.id,
                title=bm.title,
                description=bm.description,
                expected_deliverable=bm.expected_deliverable,
                recommended_evidence_type=(
                    bm.recommended_evidence_type.value
                    if hasattr(bm.recommended_evidence_type, "value")
                    else str(bm.recommended_evidence_type)
                ),
                evidence_guidance=bm.evidence_guidance,
                display_order=bm.display_order,
                created_at=bm.created_at,
            )
        )

    return ProjectBlueprintDetailResponse(
        id=bp.id,
        title=bp.title,
        slug=bp.slug,
        version=bp.version,
        summary=bp.summary,
        description=bp.description,
        learning_objectives=bp.learning_objectives,
        project_type=summary.project_type,
        difficulty_level=summary.difficulty_level,
        estimated_hours=bp.estimated_hours,
        status=summary.status,
        skills=summary.skills,
        milestones=milestones,
        created_at=bp.created_at,
        updated_at=bp.updated_at,
    )


class ProjectRecommendationService:
    """
    Deterministic runtime recommendation engine matching a student's missing skill gaps
    against platform-curated published project blueprints.
    """

    @classmethod
    def rank_blueprints_for_missing_skills(
        cls,
        db: Session,
        missing_skill_ids: Set[int],
        student_id: Optional[int] = None,
        limit: int = 6,
    ) -> List[BlueprintRecommendationItem]:
        """
        Rank published blueprints against a student's missing skill set.
        - Excludes blueprints where student already has ACTIVE or DRAFT derived projects.
        - Only missing skills contribute to the score.
        - Primary missing skill = 10 pts, Supporting missing skill = 3 pts.
        - Coverage bonus = round((total_missing_covered / len(missing_skill_ids)) * 10).
        - Deterministic tie-breaking: score DESC, missing_primary DESC, difficulty_rank ASC, estimated_hours ASC, id ASC.
        """
        if not missing_skill_ids:
            return []

        # 1. Fetch student's existing active or draft derived projects to exclude duplicates
        excluded_blueprint_ids: Set[int] = set()
        if student_id:
            existing_derived = db.scalars(
                select(InnovationProject.source_blueprint_id)
                .where(
                    InnovationProject.student_id == student_id,
                    InnovationProject.source_blueprint_id.isnot(None),
                    InnovationProject.status.in_([ProjectStatus.ACTIVE, ProjectStatus.DRAFT]),
                )
            ).all()
            excluded_blueprint_ids = {bp_id for bp_id in existing_derived if bp_id is not None}

        # 2. Query all published blueprints with loaded skills and milestones
        stmt = (
            select(ProjectBlueprint)
            .where(
                ProjectBlueprint.status == BlueprintStatus.PUBLISHED,
            )
            .options(
                selectinload(ProjectBlueprint.blueprint_skills).selectinload(ProjectBlueprintSkill.skill),
                selectinload(ProjectBlueprint.milestones),
            )
        )
        if excluded_blueprint_ids:
            stmt = stmt.where(ProjectBlueprint.id.notin_(list(excluded_blueprint_ids)))

        blueprints = list(db.scalars(stmt).unique().all())

        candidate_items: List[dict] = []
        total_missing = len(missing_skill_ids)

        for bp in blueprints:
            matched_missing: List[MatchedMissingSkillItem] = []
            primary_count = 0
            supporting_count = 0

            for bs in bp.blueprint_skills:
                if bs.skill_id in missing_skill_ids and bs.skill:
                    is_primary = bool(bs.is_primary)
                    matched_missing.append(
                        MatchedMissingSkillItem(
                            id=bs.skill.id,
                            name=bs.skill.name,
                            slug=bs.skill.slug,
                            is_primary=is_primary,
                        )
                    )
                    if is_primary:
                        primary_count += 1
                    else:
                        supporting_count += 1

            total_covered = primary_count + supporting_count
            if total_covered == 0:
                continue

            # Calculate deterministic score
            base_score = (primary_count * 10) + (supporting_count * 3)
            coverage_bonus = round((total_covered / total_missing) * 10) if total_missing > 0 else 0
            relevance_score = base_score + coverage_bonus

            diff_str = (
                bp.difficulty_level.value
                if hasattr(bp.difficulty_level, "value")
                else str(bp.difficulty_level)
            )
            diff_rank = DIFFICULTY_RANK.get(diff_str.lower(), 2)

            # Generate truthful explainable recommendation reason
            skill_names = [m.name for m in matched_missing]
            if len(skill_names) == 1:
                reason = f"Helps you build and demonstrate {skill_names[0]} through structured milestone deliverables."
            elif len(skill_names) <= 3:
                reason = f"Helps you build and demonstrate {', '.join(skill_names)} through structured milestone deliverables."
            else:
                reason = f"Helps you build and demonstrate {len(skill_names)} missing skills ({', '.join(skill_names[:3])}, and more)."

            candidate_items.append({
                "blueprint": bp,
                "matched_missing_skills": matched_missing,
                "missing_primary_count": primary_count,
                "missing_supporting_count": supporting_count,
                "total_missing_covered": total_covered,
                "relevance_score": relevance_score,
                "diff_rank": diff_rank,
                "estimated_hours": bp.estimated_hours,
                "blueprint_id": bp.id,
                "recommendation_reason": reason,
            })

        # Deterministic sort: score DESC, missing_primary DESC, diff_rank ASC, estimated_hours ASC, id ASC
        candidate_items.sort(
            key=lambda x: (
                -x["relevance_score"],
                -x["missing_primary_count"],
                x["diff_rank"],
                x["estimated_hours"],
                x["blueprint_id"],
            )
        )

        results: List[BlueprintRecommendationItem] = []
        for item in candidate_items[:limit]:
            results.append(
                BlueprintRecommendationItem(
                    blueprint=serialize_blueprint_summary(item["blueprint"]),
                    matched_missing_skills=item["matched_missing_skills"],
                    missing_primary_count=item["missing_primary_count"],
                    missing_supporting_count=item["missing_supporting_count"],
                    total_missing_covered=item["total_missing_covered"],
                    relevance_score=item["relevance_score"],
                    recommendation_reason=item["recommendation_reason"],
                )
            )

        return results
