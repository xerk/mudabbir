import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import update
from sqlalchemy.future import select

from api.db.base_client import BaseDBClient
from api.db.models import OrganizationInvitationModel

INVITATION_EXPIRY_DAYS = 7


class InvitationClient(BaseDBClient):
    """Organization invitation lifecycle: create, list pending, look up by
    token, accept, and revoke."""

    async def create_invitation(
        self,
        organization_id: int,
        email: str,
        role: str,
        invited_by_user_id: int,
        team_id: Optional[int] = None,
        expires_in_days: int = INVITATION_EXPIRY_DAYS,
    ) -> OrganizationInvitationModel:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        async with self.async_session() as session:
            invitation = OrganizationInvitationModel(
                organization_id=organization_id,
                email=email.lower(),
                role=role,
                team_id=team_id,
                token=token,
                status="pending",
                invited_by_user_id=invited_by_user_id,
                expires_at=expires_at,
            )
            session.add(invitation)
            await session.commit()
            await session.refresh(invitation)
            return invitation

    async def list_pending_invitations(
        self, organization_id: int
    ) -> List[OrganizationInvitationModel]:
        async with self.async_session() as session:
            result = await session.execute(
                select(OrganizationInvitationModel)
                .where(
                    OrganizationInvitationModel.organization_id == organization_id,
                    OrganizationInvitationModel.status == "pending",
                )
                .order_by(OrganizationInvitationModel.created_at.desc())
            )
            return list(result.scalars().all())

    async def get_invitation_by_id_for_org(
        self, invitation_id: int, organization_id: int
    ) -> Optional[OrganizationInvitationModel]:
        async with self.async_session() as session:
            result = await session.execute(
                select(OrganizationInvitationModel).where(
                    OrganizationInvitationModel.id == invitation_id,
                    OrganizationInvitationModel.organization_id == organization_id,
                )
            )
            return result.scalars().first()

    async def get_invitation_by_token(
        self, token: str
    ) -> Optional[OrganizationInvitationModel]:
        async with self.async_session() as session:
            result = await session.execute(
                select(OrganizationInvitationModel).where(
                    OrganizationInvitationModel.token == token
                )
            )
            return result.scalars().first()

    async def mark_invitation_accepted(self, invitation_id: int) -> bool:
        async with self.async_session() as session:
            stmt = (
                update(OrganizationInvitationModel)
                .where(
                    OrganizationInvitationModel.id == invitation_id,
                    OrganizationInvitationModel.status == "pending",
                )
                .values(
                    status="accepted",
                    accepted_at=datetime.now(timezone.utc),
                )
            )
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0

    async def revoke_invitation(
        self, invitation_id: int, organization_id: int
    ) -> bool:
        async with self.async_session() as session:
            stmt = (
                update(OrganizationInvitationModel)
                .where(
                    OrganizationInvitationModel.id == invitation_id,
                    OrganizationInvitationModel.organization_id == organization_id,
                    OrganizationInvitationModel.status == "pending",
                )
                .values(status="revoked")
            )
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0
