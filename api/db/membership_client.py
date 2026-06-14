from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import delete, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.future import select

from api.db.base_client import BaseDBClient
from api.db.models import (
    OrganizationModel,
    UserModel,
    organization_users_association,
)


class MembershipClient(BaseDBClient):
    """Organization membership helpers built on the
    ``organization_users`` association table (now carrying a ``role``)."""

    async def add_member_to_organization(
        self,
        user_id: int,
        organization_id: int,
        role: str = "member",
    ) -> None:
        """Link a user to an organization with the given role.

        Idempotent: if the membership already exists the role is updated to
        the supplied value (INSERT ... ON CONFLICT DO UPDATE).
        """
        async with self.async_session() as session:
            stmt = insert(organization_users_association).values(
                user_id=user_id,
                organization_id=organization_id,
                role=role,
                created_at=datetime.now(timezone.utc),
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["user_id", "organization_id"],
                set_={"role": role},
            )
            await session.execute(stmt)
            await session.commit()

    async def get_membership_role(
        self, user_id: int, organization_id: int
    ) -> Optional[str]:
        """Return the caller's role within an organization, or None if not a member."""
        async with self.async_session() as session:
            result = await session.execute(
                select(organization_users_association.c.role).where(
                    organization_users_association.c.user_id == user_id,
                    organization_users_association.c.organization_id
                    == organization_id,
                )
            )
            return result.scalars().first()

    async def list_organization_members(
        self, organization_id: int
    ) -> List[Tuple[UserModel, str, datetime]]:
        """Return (user, role, joined_at) for every member of the organization."""
        async with self.async_session() as session:
            result = await session.execute(
                select(
                    UserModel,
                    organization_users_association.c.role,
                    organization_users_association.c.created_at,
                )
                .join(
                    organization_users_association,
                    organization_users_association.c.user_id == UserModel.id,
                )
                .where(
                    organization_users_association.c.organization_id
                    == organization_id
                )
                .order_by(organization_users_association.c.created_at.asc())
            )
            return [(row[0], row[1], row[2]) for row in result.all()]

    async def update_member_role(
        self, user_id: int, organization_id: int, role: str
    ) -> bool:
        """Update a member's role. Returns False if no such membership exists."""
        async with self.async_session() as session:
            stmt = (
                update(organization_users_association)
                .where(
                    organization_users_association.c.user_id == user_id,
                    organization_users_association.c.organization_id
                    == organization_id,
                )
                .values(role=role)
            )
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0

    async def remove_member_from_organization(
        self, user_id: int, organization_id: int
    ) -> bool:
        """Remove a member from an organization. Returns False if not a member."""
        async with self.async_session() as session:
            stmt = delete(organization_users_association).where(
                organization_users_association.c.user_id == user_id,
                organization_users_association.c.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0

    async def list_user_organizations(
        self, user_id: int
    ) -> List[Tuple[OrganizationModel, str]]:
        """Return (organization, role) for every organization the user belongs to."""
        async with self.async_session() as session:
            result = await session.execute(
                select(
                    OrganizationModel,
                    organization_users_association.c.role,
                )
                .join(
                    organization_users_association,
                    organization_users_association.c.organization_id
                    == OrganizationModel.id,
                )
                .where(organization_users_association.c.user_id == user_id)
                .order_by(organization_users_association.c.created_at.asc())
            )
            return [(row[0], row[1]) for row in result.all()]

    async def is_member_of_organization(
        self, user_id: int, organization_id: int
    ) -> bool:
        """Return True if the user belongs to the organization."""
        role = await self.get_membership_role(user_id, organization_id)
        return role is not None

    async def set_selected_organization(
        self, user_id: int, organization_id: int
    ) -> None:
        """Set the user's active organization (after validating membership upstream)."""
        async with self.async_session() as session:
            stmt = (
                update(UserModel)
                .where(UserModel.id == user_id)
                .values(selected_organization_id=organization_id)
            )
            result = await session.execute(stmt)
            if result.rowcount == 0:
                raise ValueError(f"User with ID {user_id} not found")
            await session.commit()

    async def update_organization_profile(
        self,
        organization_id: int,
        name: Optional[str] = None,
        logo_url: Optional[str] = None,
        update_name: bool = False,
        update_logo: bool = False,
    ) -> Optional[OrganizationModel]:
        """Update an organization's display name and/or logo.

        ``update_name`` / ``update_logo`` flags let callers distinguish
        "set to null" from "leave unchanged".
        """
        values: dict = {}
        if update_name:
            values["name"] = name
        if update_logo:
            values["logo_url"] = logo_url

        async with self.async_session() as session:
            if values:
                await session.execute(
                    update(OrganizationModel)
                    .where(OrganizationModel.id == organization_id)
                    .values(**values)
                )
                await session.commit()
            result = await session.execute(
                select(OrganizationModel).where(
                    OrganizationModel.id == organization_id
                )
            )
            return result.scalars().first()
