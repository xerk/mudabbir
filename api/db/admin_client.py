"""Platform (super-admin) data-access helpers.

Read/write operations backing the ``/admin`` API. Everything here is gated by
``get_superuser`` at the route layer and operates across *all* organizations and
users (no per-org scoping). Built on the same ``async_session`` pattern as
``app_settings_client``; reuses existing models — no new tables.
"""

from typing import List, Optional
from uuid import uuid4

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError

from api.db.database import async_session
from api.db.models import (
    OrganizationModel,
    UserModel,
    organization_users_association,
)


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------


async def get_admin_stats() -> dict:
    """Platform-wide counters plus the 10 most recently created users."""
    async with async_session() as session:
        total_organizations = (
            await session.execute(select(func.count(OrganizationModel.id)))
        ).scalar_one()
        total_users = (
            await session.execute(select(func.count(UserModel.id)))
        ).scalar_one()

        recent_rows = (
            await session.execute(
                select(UserModel)
                .order_by(UserModel.created_at.desc())
                .limit(10)
            )
        ).scalars().all()

    return {
        "total_organizations": total_organizations,
        "total_users": total_users,
        "recent_users": [
            {
                "id": user.id,
                "email": user.email,
                "created_at": user.created_at,
            }
            for user in recent_rows
        ],
    }


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------


async def list_all_organizations() -> List[dict]:
    """Every organization with its member count, newest first."""
    member_count = func.count(organization_users_association.c.user_id)
    async with async_session() as session:
        result = await session.execute(
            select(OrganizationModel, member_count)
            .outerjoin(
                organization_users_association,
                organization_users_association.c.organization_id
                == OrganizationModel.id,
            )
            .group_by(OrganizationModel.id)
            .order_by(OrganizationModel.created_at.desc())
        )
        rows = result.all()

    return [
        {
            "id": org.id,
            "name": org.name,
            "logo_url": org.logo_url,
            "member_count": count,
            "created_at": org.created_at,
        }
        for org, count in rows
    ]


def _org_to_dict(org: OrganizationModel, member_count: int = 0) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "logo_url": org.logo_url,
        "member_count": member_count,
        "created_at": org.created_at,
    }


async def create_organization(name: str) -> dict:
    """Create an organization. ``provider_id`` is NOT NULL/unique, so we mint one."""
    async with async_session() as session:
        org = OrganizationModel(
            name=name,
            provider_id=f"org_{uuid4().hex}",
        )
        session.add(org)
        await session.commit()
        await session.refresh(org)
        # Assign a unique URL slug now that we have the id (for /{slug}/* routing).
        org.slug = f"workspace-{org.id}"
        await session.commit()
        await session.refresh(org)
        return _org_to_dict(org, member_count=0)


async def update_organization(
    org_id: int,
    name: Optional[str] = None,
    logo_url: Optional[str] = None,
    update_name: bool = False,
    update_logo: bool = False,
) -> Optional[dict]:
    """Update an organization's name and/or logo.

    The ``update_name`` / ``update_logo`` flags distinguish "set to null" from
    "leave unchanged". Returns ``None`` if the org does not exist.
    """
    values: dict = {}
    if update_name:
        values["name"] = name
    if update_logo:
        values["logo_url"] = logo_url

    async with async_session() as session:
        existing = (
            await session.execute(
                select(OrganizationModel).where(OrganizationModel.id == org_id)
            )
        ).scalar_one_or_none()
        if existing is None:
            return None

        if values:
            await session.execute(
                update(OrganizationModel)
                .where(OrganizationModel.id == org_id)
                .values(**values)
            )
            await session.commit()

        org = (
            await session.execute(
                select(OrganizationModel).where(OrganizationModel.id == org_id)
            )
        ).scalar_one()
        member_count = (
            await session.execute(
                select(func.count(organization_users_association.c.user_id)).where(
                    organization_users_association.c.organization_id == org_id
                )
            )
        ).scalar_one()
        return _org_to_dict(org, member_count=member_count)


async def delete_organization(org_id: int) -> bool:
    """Delete an organization.

    Returns ``False`` if no such org exists. Raises ``ValueError`` with a clear
    message if the org still has dependent records (FK / integrity violation).
    """
    async with async_session() as session:
        existing = (
            await session.execute(
                select(OrganizationModel.id).where(OrganizationModel.id == org_id)
            )
        ).scalar_one_or_none()
        if existing is None:
            return False

        try:
            # Clear membership links first; other dependents (workflows, etc.)
            # without cascade will surface as an IntegrityError below.
            await session.execute(
                delete(organization_users_association).where(
                    organization_users_association.c.organization_id == org_id
                )
            )
            await session.execute(
                delete(OrganizationModel).where(OrganizationModel.id == org_id)
            )
            await session.commit()
            return True
        except IntegrityError:
            await session.rollback()
            raise ValueError(
                "Cannot delete organization: it still has dependent records "
                "(workflows, campaigns, integrations, etc.). Remove them first."
            )


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


async def list_all_users() -> List[dict]:
    """Every user with the number of organizations they belong to."""
    org_count = func.count(organization_users_association.c.organization_id)
    async with async_session() as session:
        result = await session.execute(
            select(UserModel, org_count)
            .outerjoin(
                organization_users_association,
                organization_users_association.c.user_id == UserModel.id,
            )
            .group_by(UserModel.id)
            .order_by(UserModel.created_at.desc())
        )
        rows = result.all()

    return [
        {
            "id": user.id,
            "email": user.email,
            "is_superuser": bool(user.is_superuser),
            "organization_count": count,
            "created_at": user.created_at,
        }
        for user, count in rows
    ]


async def set_user_superuser(user_id: int, value: bool) -> Optional[dict]:
    """Grant/revoke superuser. Returns ``None`` if the user does not exist."""
    async with async_session() as session:
        existing = (
            await session.execute(
                select(UserModel).where(UserModel.id == user_id)
            )
        ).scalar_one_or_none()
        if existing is None:
            return None

        await session.execute(
            update(UserModel)
            .where(UserModel.id == user_id)
            .values(is_superuser=value)
        )
        await session.commit()

        user = (
            await session.execute(
                select(UserModel).where(UserModel.id == user_id)
            )
        ).scalar_one()
        org_count = (
            await session.execute(
                select(
                    func.count(organization_users_association.c.organization_id)
                ).where(organization_users_association.c.user_id == user_id)
            )
        ).scalar_one()
        return {
            "id": user.id,
            "email": user.email,
            "is_superuser": bool(user.is_superuser),
            "organization_count": org_count,
            "created_at": user.created_at,
        }


async def delete_user(user_id: int) -> bool:
    """Delete a user.

    Returns ``False`` if no such user exists. Raises ``ValueError`` if the user
    still has dependent records (FK / integrity violation).
    """
    async with async_session() as session:
        existing = (
            await session.execute(
                select(UserModel.id).where(UserModel.id == user_id)
            )
        ).scalar_one_or_none()
        if existing is None:
            return False

        try:
            # Drop membership rows first so the association FK doesn't block it.
            await session.execute(
                delete(organization_users_association).where(
                    organization_users_association.c.user_id == user_id
                )
            )
            await session.execute(
                delete(UserModel).where(UserModel.id == user_id)
            )
            await session.commit()
            return True
        except IntegrityError:
            await session.rollback()
            raise ValueError(
                "Cannot delete user: they still have dependent records "
                "(workflows, API keys, etc.). Reassign or remove them first."
            )
