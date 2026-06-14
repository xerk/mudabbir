from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from api.db import db_client
from api.db.models import UserModel
from api.services.auth.depends import (
    get_user,
    get_user_with_selected_organization,
)

router = APIRouter(prefix="/organizations", tags=["membership"])

# Roles that may mutate organization membership, invitations, teams, and profile.
ADMIN_ROLES = {"owner", "admin"}


# ---------------------------------------------------------------------------
# Authorization dependency
# ---------------------------------------------------------------------------


async def require_org_admin(
    user: UserModel = Depends(get_user_with_selected_organization),
) -> UserModel:
    """Require the caller to be an owner/admin of their active organization.

    Reads (lists) only need membership; this gate is for mutations.
    """
    role = await db_client.get_membership_role(
        user.id, user.selected_organization_id
    )
    if role is None:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this organization.",
        )
    if role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="You must be an organization owner or admin to perform this action.",
        )
    return user


async def require_org_member(
    user: UserModel = Depends(get_user_with_selected_organization),
) -> UserModel:
    """Require the caller to be a member of their active organization (for reads)."""
    role = await db_client.get_membership_role(
        user.id, user.selected_organization_id
    )
    if role is None:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this organization.",
        )
    return user


# ---------------------------------------------------------------------------
# Response / request models
# ---------------------------------------------------------------------------


class OrganizationSummary(BaseModel):
    id: int
    name: Optional[str] = None
    slug: Optional[str] = None
    logo_url: Optional[str] = None
    role: str


class MyOrganizationsResponse(BaseModel):
    organizations: List[OrganizationSummary]
    selected_organization_id: Optional[int] = None


class SelectOrganizationRequest(BaseModel):
    organization_id: int


class OrganizationMemberResponse(BaseModel):
    id: int
    email: Optional[str] = None
    role: str
    joined: datetime


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = "member"
    team_id: Optional[int] = None


class InvitationResponse(BaseModel):
    id: int
    email: str
    role: str
    team_id: Optional[int] = None
    status: str
    token: str
    accept_path: str
    expires_at: Optional[datetime] = None
    created_at: datetime


class UpdateMemberRoleRequest(BaseModel):
    role: str


class AcceptInvitationRequest(BaseModel):
    token: str


class OrganizationProfileResponse(BaseModel):
    id: int
    name: Optional[str] = None
    logo_url: Optional[str] = None


class UpdateOrganizationProfileRequest(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None


def _invitation_to_response(inv) -> InvitationResponse:
    return InvitationResponse(
        id=inv.id,
        email=inv.email,
        role=inv.role,
        team_id=inv.team_id,
        status=inv.status,
        token=inv.token,
        accept_path=f"/invite/{inv.token}",
        expires_at=inv.expires_at,
        created_at=inv.created_at,
    )


# ---------------------------------------------------------------------------
# Organization selection
# ---------------------------------------------------------------------------


@router.get("/mine", response_model=MyOrganizationsResponse)
async def list_my_organizations(user: UserModel = Depends(get_user)):
    """List the current user's organizations and their role in each."""
    rows = await db_client.list_user_organizations(user.id)
    return MyOrganizationsResponse(
        organizations=[
            OrganizationSummary(
                id=org.id,
                name=org.name,
                slug=org.slug,
                logo_url=org.logo_url,
                role=role,
            )
            for org, role in rows
        ],
        selected_organization_id=user.selected_organization_id,
    )


@router.post("/select", response_model=MyOrganizationsResponse)
async def select_organization(
    request: SelectOrganizationRequest,
    user: UserModel = Depends(get_user),
):
    """Set the user's active organization after validating membership."""
    role = await db_client.get_membership_role(user.id, request.organization_id)
    if role is None:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this organization.",
        )

    await db_client.set_selected_organization(user.id, request.organization_id)
    user.selected_organization_id = request.organization_id

    rows = await db_client.list_user_organizations(user.id)
    return MyOrganizationsResponse(
        organizations=[
            OrganizationSummary(
                id=org.id,
                name=org.name,
                slug=org.slug,
                logo_url=org.logo_url,
                role=r,
            )
            for org, r in rows
        ],
        selected_organization_id=request.organization_id,
    )


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


@router.get("/members", response_model=List[OrganizationMemberResponse])
async def list_members(user: UserModel = Depends(require_org_member)):
    """List the members of the active organization (any member may read)."""
    rows = await db_client.list_organization_members(user.selected_organization_id)
    return [
        OrganizationMemberResponse(
            id=member.id,
            email=member.email,
            role=role,
            joined=joined,
        )
        for member, role, joined in rows
    ]


@router.post("/members/invite", response_model=InvitationResponse)
async def invite_member(
    request: InviteMemberRequest,
    user: UserModel = Depends(require_org_admin),
):
    """Create a pending invitation to join the active organization."""
    organization_id = user.selected_organization_id

    if request.role not in {"owner", "admin", "member"}:
        raise HTTPException(status_code=400, detail="Invalid role.")

    # If a team is specified, it must belong to the active organization.
    if request.team_id is not None:
        team = await db_client.get_team_for_org(request.team_id, organization_id)
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found.")

    invitation = await db_client.create_invitation(
        organization_id=organization_id,
        email=str(request.email),
        role=request.role,
        invited_by_user_id=user.id,
        team_id=request.team_id,
    )

    # Send the invitation email in the background. Falls back to logging the
    # message until SMTP_* is configured in api/.env.
    from api.tasks.mail_tasks import enqueue_invitation_email

    org = await db_client.get_organization_by_id(organization_id)
    await enqueue_invitation_email(
        to_email=str(request.email),
        role=request.role,
        accept_path=f"/invite/{invitation.token}",
        org_name=(org.name if org else None) or "mudabbir",
        org_logo_url=org.logo_url if org else None,
        expires_at=invitation.expires_at,
    )
    return _invitation_to_response(invitation)


@router.put(
    "/members/{user_id}/role", response_model=OrganizationMemberResponse
)
async def update_member_role(
    user_id: int,
    request: UpdateMemberRoleRequest,
    user: UserModel = Depends(require_org_admin),
):
    """Update a member's role within the active organization."""
    organization_id = user.selected_organization_id

    if request.role not in {"owner", "admin", "member"}:
        raise HTTPException(status_code=400, detail="Invalid role.")

    target_role = await db_client.get_membership_role(user_id, organization_id)
    if target_role is None:
        raise HTTPException(status_code=404, detail="Member not found.")

    updated = await db_client.update_member_role(
        user_id, organization_id, request.role
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Member not found.")

    target = await db_client.get_user_by_id(user_id)
    return OrganizationMemberResponse(
        id=user_id,
        email=target.email if target else None,
        role=request.role,
        joined=datetime.now(timezone.utc),
    )


@router.delete("/members/{user_id}")
async def remove_member(
    user_id: int,
    user: UserModel = Depends(require_org_admin),
):
    """Remove a member from the active organization."""
    organization_id = user.selected_organization_id

    if user_id == user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot remove yourself from the organization.",
        )

    removed = await db_client.remove_member_from_organization(
        user_id, organization_id
    )
    if not removed:
        raise HTTPException(status_code=404, detail="Member not found.")
    return {"message": "Member removed from organization."}


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------


@router.get("/invitations", response_model=List[InvitationResponse])
async def list_invitations(user: UserModel = Depends(require_org_member)):
    """List pending invitations for the active organization."""
    invitations = await db_client.list_pending_invitations(
        user.selected_organization_id
    )
    return [_invitation_to_response(inv) for inv in invitations]


@router.delete("/invitations/{invitation_id}")
async def revoke_invitation(
    invitation_id: int,
    user: UserModel = Depends(require_org_admin),
):
    """Revoke a pending invitation."""
    organization_id = user.selected_organization_id

    invitation = await db_client.get_invitation_by_id_for_org(
        invitation_id, organization_id
    )
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    revoked = await db_client.revoke_invitation(invitation_id, organization_id)
    if not revoked:
        raise HTTPException(
            status_code=409,
            detail="Invitation is no longer pending and cannot be revoked.",
        )
    return {"message": "Invitation revoked."}


@router.post("/invitations/accept", response_model=OrganizationSummary)
async def accept_invitation(
    request: AcceptInvitationRequest,
    user: UserModel = Depends(get_user),
):
    """Accept an invitation: validate token/expiry/status, then add the caller
    to the organization (and team, if set) with the invited role."""
    invitation = await db_client.get_invitation_by_token(request.token)
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    if invitation.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="This invitation is no longer valid.",
        )

    if invitation.expires_at is not None:
        expires_at = invitation.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="This invitation has expired.")

    # Add caller to the organization with the invited role.
    await db_client.add_member_to_organization(
        user.id, invitation.organization_id, role=invitation.role
    )

    # If the invitation targets a team, add the caller to it too.
    if invitation.team_id is not None:
        team = await db_client.get_team_for_org(
            invitation.team_id, invitation.organization_id
        )
        if team is not None:
            await db_client.add_team_member(
                invitation.team_id, user.id, role=invitation.role
            )

    await db_client.mark_invitation_accepted(invitation.id)

    org = await db_client.get_organization_by_id(invitation.organization_id)
    return OrganizationSummary(
        id=invitation.organization_id,
        name=org.name if org else None,
        slug=org.slug if org else None,
        logo_url=org.logo_url if org else None,
        role=invitation.role,
    )


# ---------------------------------------------------------------------------
# Organization profile (name / logo only)
# ---------------------------------------------------------------------------


@router.get("/profile", response_model=OrganizationProfileResponse)
async def get_organization_profile(user: UserModel = Depends(require_org_member)):
    """Get the active organization's profile (name + logo)."""
    org = await db_client.get_organization_by_id(user.selected_organization_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return OrganizationProfileResponse(
        id=org.id,
        name=org.name,
        logo_url=org.logo_url,
    )


@router.put("/profile", response_model=OrganizationProfileResponse)
async def update_organization_profile(
    request: UpdateOrganizationProfileRequest,
    user: UserModel = Depends(require_org_admin),
):
    """Update the active organization's name and/or logo.

    Regional/security settings are a future TODO.
    """
    fields_set = request.model_fields_set
    org = await db_client.update_organization_profile(
        organization_id=user.selected_organization_id,
        name=request.name,
        logo_url=request.logo_url,
        update_name="name" in fields_set,
        update_logo="logo_url" in fields_set,
    )
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return OrganizationProfileResponse(
        id=org.id,
        name=org.name,
        logo_url=org.logo_url,
    )
