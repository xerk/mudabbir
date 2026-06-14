"""Port-aware SMTP transport.

Uses the Python standard library :mod:`smtplib` (no extra dependencies;
``aiosmtplib`` is not installed in this project), run in a worker thread via
:func:`asyncio.to_thread` so the event loop is never blocked.

Configuration is resolved at send time: the platform SMTP settings stored in
the ``app_settings`` table (super-admin managed) take precedence; when no DB
host is configured we fall back to the ``SMTP_*`` env vars from
:mod:`api.constants`.

TLS mode is derived from the port, mirroring the old TypeScript transport:

* ``465``           -> implicit TLS (``SMTP_SSL``).
* ``587``/``25``/``2525`` -> plaintext connect, then STARTTLS upgrade.
* anything else     -> honor the resolved ``secure`` flag.

If no SMTP host is configured (neither DB nor env), nothing is sent: the
rendered email is logged instead (dev fallback) so invites are testable
without an email provider.
"""

from __future__ import annotations

import asyncio
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import parseaddr
from typing import Optional

from loguru import logger

from api import constants

# Ports that use implicit TLS vs. STARTTLS, per the TS transport.
_IMPLICIT_TLS_PORT = 465
_STARTTLS_PORTS = {587, 25, 2525}


@dataclass(frozen=True)
class ResolvedSmtpConfig:
    """The effective SMTP config for a single send (DB or env)."""

    host: Optional[str]
    port: int
    user: Optional[str]
    password: Optional[str]
    secure: bool
    sender: str

    @property
    def is_live(self) -> bool:
        """True when a real SMTP host is configured (otherwise we only log)."""
        return bool(self.host)


def _env_config() -> ResolvedSmtpConfig:
    """Build the SMTP config from the ``SMTP_*`` env vars (legacy default)."""
    return ResolvedSmtpConfig(
        host=constants.SMTP_HOST,
        port=constants.SMTP_PORT,
        user=constants.SMTP_USER,
        password=constants.SMTP_PASS,
        secure=constants.SMTP_SECURE,
        sender=constants.MAIL_FROM,
    )


async def resolve_smtp_config() -> ResolvedSmtpConfig:
    """Resolve the effective SMTP config, preferring the DB over env.

    Returns the DB-stored platform settings when a host is configured there;
    otherwise falls back to the env-based config.
    """
    # Local import avoids a circular import at module load time.
    from api.db.app_settings_client import get_smtp_settings

    try:
        settings = await get_smtp_settings()
    except Exception:
        logger.exception(
            "[mail] failed to read SMTP settings from DB; falling back to env"
        )
        return _env_config()

    if not settings.host:
        return _env_config()

    return ResolvedSmtpConfig(
        host=settings.host,
        port=settings.port,
        user=settings.username or None,
        password=settings.password or None,
        secure=settings.secure,
        sender=settings.from_email or constants.MAIL_FROM,
    )


def is_live_transport() -> bool:
    """True when a real SMTP host is configured via env (otherwise we only log).

    Note: this only reflects the env config and is kept for backwards
    compatibility. The authoritative live/skip decision for a send is made on
    the :class:`ResolvedSmtpConfig` returned by :func:`resolve_smtp_config`.
    """
    return bool(constants.SMTP_HOST)


def mail_from() -> str:
    """The configured envelope/From header (env default)."""
    return constants.MAIL_FROM


def _resolve_secure(port: int, secure_flag: bool) -> bool:
    """Decide whether the connection uses implicit TLS for ``port``.

    Mismatching ``secure`` and port is the classic ``wrong version number``
    SSL error (e.g. implicit TLS against Gmail's STARTTLS port 587), so the
    well-known ports win over the configured flag.
    """
    if port == _IMPLICIT_TLS_PORT:
        return True
    if port in _STARTTLS_PORTS:
        return False
    return bool(secure_flag)


def _build_message(
    *, to: str, subject: str, html: str, text: Optional[str], sender: str
) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    # Plain-text fallback first, then the HTML alternative.
    msg.set_content(text or "")
    msg.add_alternative(html, subtype="html")
    return msg


def _send_sync(msg: EmailMessage, config: ResolvedSmtpConfig) -> None:
    """Blocking send via smtplib. Runs in a thread (see :func:`send_via_smtp`)."""
    host = config.host
    port = config.port
    user = config.user
    password = config.password
    secure = _resolve_secure(port, config.secure)

    if secure:
        with smtplib.SMTP_SSL(host, port, timeout=30) as server:
            if user:
                server.login(user, password or "")
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=30) as server:
            server.ehlo()
            # Force a STARTTLS upgrade on plaintext ports so creds never go in
            # clear when the server advertises it.
            if server.has_extn("starttls"):
                server.starttls()
                server.ehlo()
            if user:
                server.login(user, password or "")
            server.send_message(msg)


async def send_via_smtp(
    *,
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    config: Optional[ResolvedSmtpConfig] = None,
) -> bool:
    """Send one email. Falls back to logging when no SMTP host is configured.

    Resolves DB-over-env SMTP config when ``config`` is not supplied. Async-
    friendly: the blocking smtplib call is offloaded to a thread.

    Returns ``True`` when the email was actually sent, ``False`` when it was
    skipped because no SMTP host is configured (dev log fallback).
    """
    if config is None:
        config = await resolve_smtp_config()

    sender = config.sender

    if not config.is_live:
        logger.info(
            "[mail:dev] no SMTP host configured -- not sending. "
            "from={from_} to={to} subject={subject!r}\n{text}",
            from_=sender,
            to=to,
            subject=subject,
            text=text or "(no plain-text body)",
        )
        return False

    msg = _build_message(
        to=to, subject=subject, html=html, text=text, sender=sender
    )

    try:
        await asyncio.to_thread(_send_sync, msg, config)
        logger.info(
            "[mail] sent from={from_} to={to} subject={subject!r}",
            from_=parseaddr(sender)[1] or sender,
            to=to,
            subject=subject,
        )
        return True
    except Exception:
        logger.exception(
            "[mail] failed to send to={to} subject={subject!r}",
            to=to,
            subject=subject,
        )
        raise
