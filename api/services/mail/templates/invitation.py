"""Organization invitation email.

Header uses the org's own brand (name + logo); footer comes from the platform
context. Body markup goes through the shared layout helpers so it matches every
other template. Ported from ``packages/mail/templates/org/invitation.ts``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Tuple

from api.services.mail.templates.layout import (
    escape_html,
    heading,
    muted,
    paragraph,
    render_button,
    render_email_layout,
)


def render_invitation_email(
    *,
    org_name: str,
    logo_url: Optional[str],
    accept_url: str,
    role: str,
    expires_at: Optional[datetime] = None,
    support_email: Optional[str] = None,
    unsubscribe_url: Optional[str] = None,
) -> Tuple[str, str, str]:
    """Render the invitation email.

    Returns:
        ``(subject, html, text)``.
    """
    org = escape_html(org_name)
    role_label = escape_html(role)
    url = accept_url

    subject = f"You're invited to join {org_name}"

    expiry_line_html = ""
    expiry_line_text = ""
    if expires_at is not None:
        when = expires_at.strftime("%B %d, %Y")
        expiry_line_html = muted(f"This invitation expires on {escape_html(when)}.")
        expiry_line_text = f"\nThis invitation expires on {when}."

    content_html = "".join(
        [
            heading(f"You're invited to join {org_name}"),
            paragraph(
                f"You've been invited to join <strong>{org}</strong> "
                f"as <strong>{role_label}</strong>."
            ),
            f'<div style="padding:8px 0 18px;">'
            f"{render_button(url, 'Accept invitation')}</div>",
            muted(
                "Or paste this link into your browser:<br>"
                f'<a href="{url}" style="color:#52525b;word-break:break-all;">'
                f"{escape_html(url)}</a>"
            ),
            expiry_line_html,
        ]
    )

    html = render_email_layout(
        content_html,
        platform_name=org_name,
        logo_url=logo_url,
        preview_text=f"You're invited to join {org_name}",
        support_email=support_email,
        unsubscribe_url=unsubscribe_url,
    )

    text = (
        f"You've been invited to join {org_name} as {role}.\n\n"
        "Accept the invitation:\n"
        f"{url}{expiry_line_text}\n\n"
        "If you weren't expecting this, you can ignore this email."
    )

    return subject, html, text
