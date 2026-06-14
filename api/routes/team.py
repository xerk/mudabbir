from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.db import db_client
from api.db.models import UserModel
from api.routes.membership import require_org_admin, require_org_member

router = APIRouter(prefix="/organizations/teams", tags=["teams"])


# ---------------------------------------------------------------------------
# Response / request models
# ---------------------------------------------------------------------------


class TeamResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class CreateTeamRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateTeamRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TeamMemberResponse(BaseModel):
    id: int
    user_id: int
    email: Optional[str] = None
    role: str
    created_at: datetime


class AddTeamMemberRequest(BaseModel):
    user_id: int
    role: str = "member"


def _team_to_response(team) -> "TeamResponse":
    return TeamResponse(
        id=team.id,
        organization_id=team.organization_id,
        name=team.name,
        description=team.description,
        created_at=team.created_at,
        updated_at=team.updated_at,
    )


# ---------------------------------------------------------------------------
# Team CRUD
# ---------------------------------------------------------------------------


@router.get("", response_model=List[TeamResponse])
async def list_teams(user: UserModel = Depends(require_org_member)):
    """List the teams in the active organization (any member may read)."""
    teams = await db_client.list_teams(user.selected_organization_id)
    return [_team_to_response(t) for t in teams]


@router.post("", response_model=TeamResponse)
async def create_team(
    request: CreateTeamRequest,
    user: UserModel = Depends(require_org_admin),
):
    """Create a team in the active organization."""
    if not request.name or not request.name.strip():
        raise HTTPException(status_code=400, detail="Team name is required.")
    team = await db_client.create_team(
        organization_id=user.selected_organization_id,
        name=request.name.strip(),
        description=request.description,
    )
    return _team_to_response(team)


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: int,
    request: UpdateTeamRequest,
    user: UserModel = Depends(require_org_admin),
):
    """Update a team's name and/or description."""
    organization_id = user.selected_organization_id
    existing = await db_client.get_team_for_org(team_id, organization_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Team not found.")

    fields_set = request.model_fields_set
    name = request.name.strip() if request.name is not None else None
    if "name" in fields_set and not name:
        raise HTTPException(status_code=400, detail="Team name cannot be empty.")

    team = await db_client.update_team(
        team_id=team_id,
        organization_id=organization_id,
        name=name,
        description=request.description,
        update_description="description" in fields_set,
    )
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found.")
    return _team_to_response(team)


@router.delete("/{team_id}")
async def delete_team(
    team_id: int,
    user: UserModel = Depends(require_org_admin),
):
    """Delete a team (and its memberships) from the active organization."""
    deleted = await db_client.delete_team(team_id, user.selected_organization_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Team not found.")
    return {"message": "Team deleted."}


# ---------------------------------------------------------------------------
# Team membership
# ---------------------------------------------------------------------------


async def _ensure_team_in_org(team_id: int, organization_id: int):
    team = await db_client.get_team_for_org(team_id, organization_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found.")
    return team


@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    team_id: int,
    user: UserModel = Depends(require_org_member),
):
    """List the members of a team (any org member may read)."""
    await _ensure_team_in_org(team_id, user.selected_organization_id)
    rows = await db_client.list_team_members(team_id)
    return [
        TeamMemberResponse(
            id=member.id,
            user_id=member.user_id,
            email=member_user.email,
            role=member.role,
            created_at=member.created_at,
        )
        for member, member_user in rows
    ]


@router.post("/{team_id}/members", response_model=TeamMemberResponse)
async def add_team_member(
    team_id: int,
    request: AddTeamMemberRequest,
    user: UserModel = Depends(require_org_admin),
):
    """Add an organization member to a team."""
    organization_id = user.selected_organization_id
    await _ensure_team_in_org(team_id, organization_id)

    if request.role not in {"owner", "admin", "member"}:
        raise HTTPException(status_code=400, detail="Invalid role.")

    # The user must already be a member of the organization.
    member_role = await db_client.get_membership_role(
        request.user_id, organization_id
    )
    if member_role is None:
        raise HTTPException(
            status_code=400,
            detail="User is not a member of this organization.",
        )

    member = await db_client.add_team_member(
        team_id, request.user_id, role=request.role
    )
    target = await db_client.get_user_by_id(request.user_id)
    return TeamMemberResponse(
        id=member.id,
        user_id=member.user_id,
        email=target.email if target else None,
        role=member.role,
        created_at=member.created_at,
    )


@router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: int,
    user_id: int,
    user: UserModel = Depends(require_org_admin),
):
    """Remove a member from a team."""
    await _ensure_team_in_org(team_id, user.selected_organization_id)
    removed = await db_client.remove_team_member(team_id, user_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Team member not found.")
    return {"message": "Team member removed."}
