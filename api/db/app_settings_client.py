"""Storage + models for platform-wide (global) settings.

Stored as ``key -> JSON`` in the ``app_settings`` table (super-admin managed).
The global security policy lives under the ``security`` key. This is distinct
from per-organization settings (those live in ``organization_configurations``).
"""

from typing import Optional

from pydantic import BaseModel
from sqlalchemy import select

from api.db.database import async_session
from api.db.models import AppSettingModel

SECURITY_KEY = "security"
SMTP_KEY = "smtp"


class SecuritySettings(BaseModel):
    """Platform-wide security policy."""

    # Require all users to enable two-factor authentication
    requireTwoFactor: bool = False
    # Idle session timeout in minutes; 0 = never
    sessionTimeoutMinutes: int = 0
    # Comma-separated email domains allowed to sign up / be invited; blank = any
    allowedEmailDomains: str = ""


class SecuritySettingsPatch(BaseModel):
    requireTwoFactor: Optional[bool] = None
    sessionTimeoutMinutes: Optional[int] = None
    allowedEmailDomains: Optional[str] = None


DEFAULT_SECURITY_SETTINGS = SecuritySettings()


async def _get_app_setting(key: str) -> Optional[dict]:
    async with async_session() as session:
        result = await session.execute(
            select(AppSettingModel).where(AppSettingModel.key == key)
        )
        row = result.scalar_one_or_none()
        return dict(row.value) if row and row.value else None


async def _set_app_setting(key: str, value: dict) -> None:
    async with async_session() as session:
        result = await session.execute(
            select(AppSettingModel).where(AppSettingModel.key == key)
        )
        row = result.scalar_one_or_none()
        if row is None:
            session.add(AppSettingModel(key=key, value=value))
        else:
            row.value = value
        await session.commit()


async def get_security_settings() -> SecuritySettings:
    """Return the global security policy, merged over defaults."""
    stored = await _get_app_setting(SECURITY_KEY) or {}
    return SecuritySettings(**stored)


async def update_security_settings(patch: SecuritySettingsPatch) -> SecuritySettings:
    """Apply a partial patch to the global security policy (definedOnly)."""
    current = await get_security_settings()
    updates = patch.model_dump(exclude_unset=True)
    merged = current.model_copy(update=updates)
    await _set_app_setting(SECURITY_KEY, merged.model_dump())
    return merged


class SmtpSettings(BaseModel):
    """Platform-wide outbound SMTP configuration (super-admin managed)."""

    # SMTP server hostname; blank means "not configured" (dev log fallback).
    host: str = ""
    # SMTP server port (465 = implicit TLS, 587/25/2525 = STARTTLS).
    port: int = 587
    # SMTP auth username; blank to connect without login.
    username: str = ""
    # SMTP auth password.
    password: str = ""
    # Force implicit TLS regardless of port heuristics.
    secure: bool = False
    # The envelope/From header used for outbound mail.
    from_email: str = ""


class SmtpSettingsPatch(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    secure: Optional[bool] = None
    from_email: Optional[str] = None


DEFAULT_SMTP_SETTINGS = SmtpSettings()


async def get_smtp_settings() -> SmtpSettings:
    """Return the global SMTP configuration, merged over defaults."""
    stored = await _get_app_setting(SMTP_KEY) or {}
    return SmtpSettings(**stored)


async def update_smtp_settings(patch: SmtpSettingsPatch) -> SmtpSettings:
    """Apply a partial patch to the global SMTP configuration (definedOnly)."""
    current = await get_smtp_settings()
    updates = patch.model_dump(exclude_unset=True)
    merged = current.model_copy(update=updates)
    await _set_app_setting(SMTP_KEY, merged.model_dump())
    return merged
