"""Lightweight i18n for user-facing API messages.

English is the default. Behavior is unchanged for ``en`` requests and for any
message that is not present in :data:`TRANSLATIONS` (it falls back to the
original English string).
"""

from api.i18n.translations import (
    TRANSLATIONS,
    current_locale,
    resolve_locale,
    translate,
)

__all__ = [
    "TRANSLATIONS",
    "current_locale",
    "resolve_locale",
    "translate",
]
