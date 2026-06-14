"""Storage helpers for the outbound-email audit log (``mail_log`` table).

Every send attempt (sent / failed / skipped) is recorded here so super-admins
can inspect delivery history. Records are append-only; nothing is updated.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from api.db.database import async_session
from api.db.models import MailLogModel


async def record_send(
    to_email: str,
    subject: Optional[str],
    template: Optional[str],
    status: str,
    error: Optional[str] = None,
    provider_message_id: Optional[str] = None,
) -> None:
    """Insert one outbound-email record.

    Args:
        to_email: Recipient address.
        subject: Email subject, if known.
        template: Template name (e.g. ``"invitation"``).
        status: One of ``sent`` | ``failed`` | ``skipped``.
        error: Error string when ``status == "failed"``.
        provider_message_id: Upstream message id when available.
    """
    async with async_session() as session:
        session.add(
            MailLogModel(
                to_email=to_email,
                subject=subject,
                template=template,
                status=status,
                error=error,
                provider_message_id=provider_message_id,
            )
        )
        await session.commit()


async def list_recent(limit: int = 100, offset: int = 0) -> list[dict]:
    """Return the most-recent mail-log rows (newest first)."""
    async with async_session() as session:
        result = await session.execute(
            select(MailLogModel)
            .order_by(MailLogModel.created_at.desc(), MailLogModel.id.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = result.scalars().all()
        return [
            {
                "id": row.id,
                "to_email": row.to_email,
                "subject": row.subject,
                "template": row.template,
                "status": row.status,
                "error": row.error,
                "provider_message_id": row.provider_message_id,
                "created_at": row.created_at,
            }
            for row in rows
        ]
