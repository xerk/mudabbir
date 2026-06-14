"""Generic email send entrypoint.

Thin wrapper over the transport so callers (templates, tasks) have one place to
send a fully-rendered email regardless of how it was built.
"""

from __future__ import annotations

from typing import Optional

from api.services.mail.transport import send_via_smtp


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> bool:
    """Send a rendered email (HTML + optional plain-text fallback).

    Returns ``True`` when the email was sent, ``False`` when skipped because
    no SMTP host is configured (dev log fallback).
    """
    return await send_via_smtp(to=to, subject=subject, html=html, text=text)
