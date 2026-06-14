"""Workspace settings hub: regional + security settings for the active org.

Mirrors the old GraphQL ``orgSettings`` / ``updateOrgSettings`` surface. Reads
are open to any org member; writes are gated to owners/admins. Both are always
scoped to the caller's active (selected) organization — never a client-supplied
id. Settings persist as JSON under the ``ORG_SETTINGS`` configuration key.
"""

from fastapi import APIRouter, Depends, HTTPException

from api.db import org_settings_client
from api.db.models import UserModel
from api.routes.membership import require_org_admin, require_org_member

router = APIRouter(prefix="/organizations/settings", tags=["org-settings"])


@router.get("", response_model=org_settings_client.OrgSettings)
async def get_settings(
    user: UserModel = Depends(require_org_member),
) -> org_settings_client.OrgSettings:
    """Regional + security settings for the active organization (any member)."""
    if not user.selected_organization_id:
        raise HTTPException(
            status_code=403,
            detail="No active organization for this session.",
        )
    return await org_settings_client.get_org_settings(
        user.selected_organization_id
    )


@router.put("", response_model=org_settings_client.OrgSettings)
async def update_settings(
    request: org_settings_client.UpdateOrgSettingsRequest,
    user: UserModel = Depends(require_org_admin),
) -> org_settings_client.OrgSettings:
    """Patch the active organization's settings (owner/admin only).

    Only the groups/fields present in the request are changed; everything else
    keeps its current value.
    """
    if not user.selected_organization_id:
        raise HTTPException(
            status_code=403,
            detail="No active organization for this session.",
        )
    return await org_settings_client.update_org_settings(
        user.selected_organization_id, request
    )
