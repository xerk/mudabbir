from typing import List, Optional, Tuple

from sqlalchemy import delete, update
from sqlalchemy.future import select

from api.db.base_client import BaseDBClient
from api.db.models import TeamMemberModel, TeamModel, UserModel


class TeamClient(BaseDBClient):
    """Team CRUD plus team-membership management. Teams group people within an
    organization; resources stay org-scoped."""

    # ------------------------------------------------------------------
    # Team CRUD
    # ------------------------------------------------------------------

    async def list_teams(self, organization_id: int) -> List[TeamModel]:
        async with self.async_session() as session:
            result = await session.execute(
                select(TeamModel)
                .where(TeamModel.organization_id == organization_id)
                .order_by(TeamModel.created_at.asc())
            )
            return list(result.scalars().all())

    async def get_team_for_org(
        self, team_id: int, organization_id: int
    ) -> Optional[TeamModel]:
        async with self.async_session() as session:
            result = await session.execute(
                select(TeamModel).where(
                    TeamModel.id == team_id,
                    TeamModel.organization_id == organization_id,
                )
            )
            return result.scalars().first()

    async def create_team(
        self,
        organization_id: int,
        name: str,
        description: Optional[str] = None,
    ) -> TeamModel:
        async with self.async_session() as session:
            team = TeamModel(
                organization_id=organization_id,
                name=name,
                description=description,
            )
            session.add(team)
            await session.commit()
            await session.refresh(team)
            return team

    async def update_team(
        self,
        team_id: int,
        organization_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        update_description: bool = False,
    ) -> Optional[TeamModel]:
        values: dict = {}
        if name is not None:
            values["name"] = name
        if update_description:
            values["description"] = description

        async with self.async_session() as session:
            if values:
                await session.execute(
                    update(TeamModel)
                    .where(
                        TeamModel.id == team_id,
                        TeamModel.organization_id == organization_id,
                    )
                    .values(**values)
                )
                await session.commit()
            result = await session.execute(
                select(TeamModel).where(
                    TeamModel.id == team_id,
                    TeamModel.organization_id == organization_id,
                )
            )
            return result.scalars().first()

    async def delete_team(self, team_id: int, organization_id: int) -> bool:
        async with self.async_session() as session:
            stmt = delete(TeamModel).where(
                TeamModel.id == team_id,
                TeamModel.organization_id == organization_id,
            )
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0

    # ------------------------------------------------------------------
    # Team membership
    # ------------------------------------------------------------------

    async def list_team_members(
        self, team_id: int
    ) -> List[Tuple[TeamMemberModel, UserModel]]:
        """Return (team_member, user) pairs for a team."""
        async with self.async_session() as session:
            result = await session.execute(
                select(TeamMemberModel, UserModel)
                .join(UserModel, UserModel.id == TeamMemberModel.user_id)
                .where(TeamMemberModel.team_id == team_id)
                .order_by(TeamMemberModel.created_at.asc())
            )
            return [(row[0], row[1]) for row in result.all()]

    async def get_team_member(
        self, team_id: int, user_id: int
    ) -> Optional[TeamMemberModel]:
        async with self.async_session() as session:
            result = await session.execute(
                select(TeamMemberModel).where(
                    TeamMemberModel.team_id == team_id,
                    TeamMemberModel.user_id == user_id,
                )
            )
            return result.scalars().first()

    async def add_team_member(
        self, team_id: int, user_id: int, role: str = "member"
    ) -> TeamMemberModel:
        """Add a user to a team. Returns the existing membership if present
        (idempotent on the unique (team_id, user_id) constraint)."""
        existing = await self.get_team_member(team_id, user_id)
        if existing is not None:
            return existing
        async with self.async_session() as session:
            member = TeamMemberModel(
                team_id=team_id,
                user_id=user_id,
                role=role,
            )
            session.add(member)
            await session.commit()
            await session.refresh(member)
            return member

    async def remove_team_member(self, team_id: int, user_id: int) -> bool:
        async with self.async_session() as session:
            stmt = delete(TeamMemberModel).where(
                TeamMemberModel.team_id == team_id,
                TeamMemberModel.user_id == user_id,
            )
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0
