"""Storage + models for per-organization workspace settings.

Settings (regional + security) are stored as a single JSON blob under the
``ORG_SETTINGS`` key in the existing ``organization_configurations`` table —
no new tables. Reads merge the stored value over a set of defaults so a row
that predates a newly-added field still resolves to a complete object; writes
deep-merge a partial patch (``definedOnly`` semantics) so only the groups/fields
actually sent by the client change, mirroring the old TypeScript implementation.
"""

from typing import Optional

from pydantic import BaseModel, Field

from api.db import db_client
from api.enums import OrganizationConfigurationKey

ORG_SETTINGS_KEY = OrganizationConfigurationKey.ORG_SETTINGS.value


# ---------------------------------------------------------------------------
# Models (mirror the old GraphQL DTO shape)
# ---------------------------------------------------------------------------


class RegionalSettings(BaseModel):
    """Regional / formatting preferences for an organization."""

    # IANA timezone, e.g. "UTC", "Asia/Riyadh"
    timezone: str = "UTC"
    # Date format token, e.g. "MMM D, YYYY"
    dateFormat: str = "MMM D, YYYY"
    # "12h" or "24h"
    timeFormat: str = "12h"
    # ISO 4217 currency code, e.g. "USD", "SAR"
    currency: str = "USD"
    # Number/locale format, e.g. "en-US", "ar-SA"
    numberFormat: str = "en-US"


class SecuritySettings(BaseModel):
    """Security policy for an organization."""

    # Require members to enable 2FA
    requireTwoFactor: bool = False
    # Idle session timeout in minutes; 0 = none
    sessionTimeoutMinutes: int = 0
    # Comma-separated email domains allowed to be invited; blank = any
    allowedEmailDomains: str = ""


class OrgSettings(BaseModel):
    """Per-organization settings (regional + security)."""

    regional: RegionalSettings = Field(default_factory=RegionalSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)


# Patch models: every field optional so a partial patch never clobbers stored
# values. Only fields explicitly present in the request are applied.


class RegionalSettingsPatch(BaseModel):
    timezone: Optional[str] = None
    dateFormat: Optional[str] = None
    timeFormat: Optional[str] = None
    currency: Optional[str] = None
    numberFormat: Optional[str] = None


class SecuritySettingsPatch(BaseModel):
    requireTwoFactor: Optional[bool] = None
    sessionTimeoutMinutes: Optional[int] = None
    allowedEmailDomains: Optional[str] = None


class UpdateOrgSettingsRequest(BaseModel):
    """Patch an organization's settings (only sent groups/fields change)."""

    regional: Optional[RegionalSettingsPatch] = None
    security: Optional[SecuritySettingsPatch] = None


# Defaults applied when an org has no stored settings yet.
DEFAULT_ORG_SETTINGS = OrgSettings()


# ---------------------------------------------------------------------------
# Storage helpers (use the shared db_client, which mixes in the
# OrganizationConfigurationClient operations).
# ---------------------------------------------------------------------------


def _merge_with_defaults(stored: Optional[dict]) -> OrgSettings:
    """Merge a stored (possibly partial / missing) value over defaults."""
    stored = stored or {}
    regional = dict(stored.get("regional") or {})
    security = dict(stored.get("security") or {})
    return OrgSettings(
        regional=RegionalSettings(**regional),
        security=SecuritySettings(**security),
    )


async def get_org_settings(organization_id: int) -> OrgSettings:
    """Return the org's settings, merged over defaults (always complete)."""
    stored = await db_client.get_configuration_value(
        organization_id, ORG_SETTINGS_KEY, default=None
    )
    return _merge_with_defaults(stored)


async def update_org_settings(
    organization_id: int, partial: UpdateOrgSettingsRequest
) -> OrgSettings:
    """Deep-merge a partial patch into the stored settings.

    ``definedOnly`` semantics: only fields explicitly set on the incoming patch
    are applied; everything else keeps its current (or default) value. The
    settings live under a dedicated configuration key, so no other org data is
    touched.
    """
    current = await get_org_settings(organization_id)

    if partial.regional is not None:
        regional_patch = partial.regional.model_dump(exclude_unset=True)
        current.regional = current.regional.model_copy(update=regional_patch)

    if partial.security is not None:
        security_patch = partial.security.model_dump(exclude_unset=True)
        current.security = current.security.model_copy(update=security_patch)

    await db_client.upsert_configuration(
        organization_id, ORG_SETTINGS_KEY, current.model_dump()
    )
    return current
