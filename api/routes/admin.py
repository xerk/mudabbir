"""Super-admin (platform) management API.

Every endpoint is gated by ``get_superuser``. These operate across *all*
organizations and users (no per-org scoping) and back the platform admin
dashboard. No new tables/migrations — reuses existing models via
``api.db.admin_client``.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.db import admin_client
from api.db.models import UserModel
from api.services.auth.depends import get_superuser

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Response / request models
# ---------------------------------------------------------------------------


class RecentUser(BaseModel):
    id: int
    email: Optional[str] = None
    created_at: datetime


class AdminStatsResponse(BaseModel):
    total_organizations: int
    total_users: int
    recent_users: List[RecentUser]


class AdminOrganizationResponse(BaseModel):
    id: int
    name: Optional[str] = None
    logo_url: Optional[str] = None
    member_count: int
    created_at: datetime


class CreateOrganizationRequest(BaseModel):
    name: str


class UpdateOrganizationRequest(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None


class AdminUserResponse(BaseModel):
    id: int
    email: Optional[str] = None
    is_superuser: bool
    organization_count: int
    created_at: datetime


class SetSuperuserRequest(BaseModel):
    is_superuser: bool


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(_user: UserModel = Depends(get_superuser)):
    """Platform-wide counters and the 10 most recent users (super-admin only)."""
    stats = await admin_client.get_admin_stats()
    return AdminStatsResponse(**stats)


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------


@router.get("/organizations", response_model=List[AdminOrganizationResponse])
async def list_organizations(_user: UserModel = Depends(get_superuser)):
    """List every organization with its member count."""
    orgs = await admin_client.list_all_organizations()
    return [AdminOrganizationResponse(**org) for org in orgs]


@router.post("/organizations", response_model=AdminOrganizationResponse)
async def create_organization(
    request: CreateOrganizationRequest,
    _user: UserModel = Depends(get_superuser),
):
    """Create a new organization."""
    org = await admin_client.create_organization(name=request.name)
    return AdminOrganizationResponse(**org)


@router.put(
    "/organizations/{org_id}", response_model=AdminOrganizationResponse
)
async def update_organization(
    org_id: int,
    request: UpdateOrganizationRequest,
    _user: UserModel = Depends(get_superuser),
):
    """Update an organization's name and/or logo."""
    fields_set = request.model_fields_set
    org = await admin_client.update_organization(
        org_id=org_id,
        name=request.name,
        logo_url=request.logo_url,
        update_name="name" in fields_set,
        update_logo="logo_url" in fields_set,
    )
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return AdminOrganizationResponse(**org)


@router.delete("/organizations/{org_id}")
async def delete_organization(
    org_id: int,
    _user: UserModel = Depends(get_superuser),
):
    """Delete an organization (fails if it still has dependent records)."""
    try:
        deleted = await admin_client.delete_organization(org_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not deleted:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return {"message": "Organization deleted."}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.get("/users", response_model=List[AdminUserResponse])
async def list_users(_user: UserModel = Depends(get_superuser)):
    """List every user with their organization count."""
    users = await admin_client.list_all_users()
    return [AdminUserResponse(**user) for user in users]


@router.put("/users/{user_id}/superuser", response_model=AdminUserResponse)
async def set_user_superuser(
    user_id: int,
    request: SetSuperuserRequest,
    user: UserModel = Depends(get_superuser),
):
    """Grant or revoke a user's superuser privilege.

    A super-admin cannot revoke their own superuser flag.
    """
    if user_id == user.id and not request.is_superuser:
        raise HTTPException(
            status_code=400,
            detail="You cannot remove your own superuser privileges.",
        )

    updated = await admin_client.set_user_superuser(user_id, request.is_superuser)
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return AdminUserResponse(**updated)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    user: UserModel = Depends(get_superuser),
):
    """Delete a user (cannot delete yourself; fails on dependent records)."""
    if user_id == user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete yourself.",
        )

    try:
        deleted = await admin_client.delete_user(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"message": "User deleted."}
