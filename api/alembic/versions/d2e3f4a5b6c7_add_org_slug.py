"""add slug to organizations (multi-tenant /{slug}/* routing)

Revision ID: d2e3f4a5b6c7
Revises: c1f2a3b4d5e6
Create Date: 2026-06-12 01:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c1f2a3b4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("slug", sa.String(), nullable=True))
    op.create_index(op.f("ix_organizations_slug"), "organizations", ["slug"], unique=True)
    # Backfill a deterministic slug for existing orgs that don't have one.
    op.execute("UPDATE organizations SET slug = 'workspace-' || id WHERE slug IS NULL")


def downgrade() -> None:
    op.drop_index(op.f("ix_organizations_slug"), table_name="organizations")
    op.drop_column("organizations", "slug")
