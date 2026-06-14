"""ARQ background tasks for outbound email.

The processor is a thin adapter: it renders a template and hands off to the
mail transport. Business decisions (who to invite, the role, expiry) are made by
the caller; this just delivers. Handlers are idempotent -- re-running resends
the same email, which is acceptable for transactional invites.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from loguru import logger

from api import constants
from api.db import mail_log_client
from api.services.mail.send import send_email
from api.services.mail.templates.invitation import render_invitation_email
from api.tasks.function_names import FunctionNames

_INVITATION_TEMPLATE = "invitation"


def _build_accept_url(accept_path: str) -> str:
    """Turn an accept *path* ("/invite/<token>") into an absolute UI URL."""
    base = constants.UI_APP_URL.rstrip("/")
    path = accept_path if accept_path.startswith("/") else f"/{accept_path}"
    return f"{base}{path}"


async def send_invitation_email(
    _ctx,
    to_email: str,
    role: str,
    accept_path: str,
    org_name: str,
    org_logo_url: Optional[str] = None,
    expires_at_iso: Optional[str] = None,
) -> None:
    """Render and send an organization invitation email.

    Args:
        _ctx: ARQ context (unused).
        to_email: Invitee's email address.
        role: Invited role (owner/admin/member).
        accept_path: Relative accept path, e.g. ``/invite/<token>``.
        org_name: Inviting organization's name (header brand).
        org_logo_url: Inviting organization's logo URL, if any.
        expires_at_iso: Optional ISO-8601 expiry timestamp.
    """
    logger.info(
        "[mail] preparing invitation email to={to} org={org!r} role={role}",
        to=to_email,
        org=org_name,
        role=role,
    )

    expires_at: Optional[datetime] = None
    if expires_at_iso:
        try:
            expires_at = datetime.fromisoformat(expires_at_iso)
        except ValueError:
            logger.warning(
                "[mail] could not parse expires_at={value!r}; omitting expiry line",
                value=expires_at_iso,
            )

    subject, html, text = render_invitation_email(
        org_name=org_name or constants.MAIL_PLATFORM_NAME,
        logo_url=org_logo_url,
        accept_url=_build_accept_url(accept_path),
        role=role,
        expires_at=expires_at,
        support_email=constants.MAIL_SUPPORT_EMAIL,
    )

    try:
        sent = await send_email(to=to_email, subject=subject, html=html, text=text)
    except Exception as exc:
        # Record the failure, then re-raise so ARQ's retry/backoff still kicks in.
        await mail_log_client.record_send(
            to_email=to_email,
            subject=subject,
            template=_INVITATION_TEMPLATE,
            status="failed",
            error=str(exc),
        )
        raise

    # ``sent is False`` means no SMTP host configured -> dev log fallback.
    await mail_log_client.record_send(
        to_email=to_email,
        subject=subject,
        template=_INVITATION_TEMPLATE,
        status="sent" if sent else "skipped",
    )


async def enqueue_invitation_email(
    *,
    to_email: str,
    role: str,
    accept_path: str,
    org_name: str,
    org_logo_url: Optional[str] = None,
    expires_at: Optional[datetime] = None,
) -> None:
    """Enqueue an invitation email via the shared ARQ pool.

    Safe to call from a request handler: it only enqueues, it does not send.
    """
    # Local import avoids a circular import (arq.py imports the task functions).
    from api.tasks.arq import enqueue_job

    await enqueue_job(
        FunctionNames.SEND_INVITATION_EMAIL,
        to_email,
        role,
        accept_path,
        org_name,
        org_logo_url,
        expires_at.isoformat() if expires_at is not None else None,
    )
