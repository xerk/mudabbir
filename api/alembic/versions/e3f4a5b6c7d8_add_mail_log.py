"""add mail_log table

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-06-12 02:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mail_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("to_email", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=True),
        sa.Column("template", sa.String(), nullable=True),
        sa.Column("status", sa.String(), server_default=sa.text("'sent'"), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("provider_message_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_mail_log_to_email"), "mail_log", ["to_email"], unique=False)
    op.create_index(op.f("ix_mail_log_created_at"), "mail_log", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_mail_log_created_at"), table_name="mail_log")
    op.drop_index(op.f("ix_mail_log_to_email"), table_name="mail_log")
    op.drop_table("mail_log")
