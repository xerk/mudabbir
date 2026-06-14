"""Shared, brandable email shell (header + footer + body helpers).

Ported from the TypeScript ``packages/mail`` layout. Intentionally monochrome
and minimal: a light shell, neutral grays, a single near-black button. No brand
colors -- clean by default so every template reads the same and stays legible
across clients. Inline styles only (clients strip ``<style>``/external CSS).

The header and footer are CENTERED. Call :func:`render_email_layout` from every
template so they stay visually consistent.
"""

from __future__ import annotations

from typing import Optional

# Monochrome palette. Keep in sync with the TS package.
_COLORS = {
    "page": "#f5f5f6",
    "card": "#ffffff",
    "border": "#e8e8ea",
    "heading": "#111114",
    "text": "#3f3f46",
    "muted": "#8a8a93",
    "link": "#52525b",
}


def escape_html(value: str) -> str:
    """Escape the characters that matter inside HTML text/attribute contexts."""
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _header(platform_name: str, logo_url: Optional[str]) -> str:
    """Centered brand mark: the logo if set, else a clean wordmark."""
    if logo_url:
        inner = (
            f'<img src="{logo_url}" alt="{escape_html(platform_name)}" height="36" '
            'style="height:36px;max-height:36px;width:auto;display:inline-block;border:0;" />'
        )
    else:
        inner = (
            '<span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;'
            f'color:{_COLORS["heading"]};">{escape_html(platform_name)}</span>'
        )
    return (
        '<tr><td align="center" style="padding:40px 40px 0;text-align:center;">'
        f"{inner}</td></tr>"
    )


def _footer(
    platform_name: str,
    support_email: Optional[str],
    unsubscribe_url: Optional[str],
) -> str:
    links = []
    if support_email:
        links.append(
            f'<a href="mailto:{support_email}" '
            f'style="color:{_COLORS["link"]};text-decoration:none;">Contact support</a>'
        )
    if unsubscribe_url:
        links.append(
            f'<a href="{unsubscribe_url}" '
            f'style="color:{_COLORS["link"]};text-decoration:none;">Unsubscribe</a>'
        )
    link_row = ""
    if links:
        joined = " &nbsp;&middot;&nbsp; ".join(links)
        link_row = (
            f'<p style="margin:0 0 6px;font-size:12px;color:{_COLORS["muted"]};">'
            f"{joined}</p>"
        )
    return (
        '<tr><td align="center" style="padding:8px 40px 36px;text-align:center;">'
        f'<div style="height:1px;background:{_COLORS["border"]};margin:0 0 20px;"></div>'
        f"{link_row}"
        f'<p style="margin:0;font-size:12px;color:{_COLORS["muted"]};">'
        f"Sent by {escape_html(platform_name)}</p>"
        "</td></tr>"
    )


def render_email_layout(
    content_html: str,
    *,
    platform_name: str,
    logo_url: Optional[str] = None,
    support_email: Optional[str] = None,
    unsubscribe_url: Optional[str] = None,
    preview_text: Optional[str] = None,
) -> str:
    """Wrap body content in the shared, brandable email shell.

    Args:
        content_html: The body markup (already built with the helpers below).
        platform_name: Brand name shown in the centered header + footer.
        logo_url: Optional brand logo; falls back to a wordmark.
        support_email: When set, a "Contact support" footer link is rendered.
        unsubscribe_url: When set, an "Unsubscribe" footer link is rendered.
        preview_text: Hidden inbox-preview line.
    """
    preview = ""
    if preview_text:
        preview = (
            '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
            f"{escape_html(preview_text)}</div>"
        )
    return f"""<!doctype html>
<html>
  <body style="margin:0;background:{_COLORS["page"]};font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:{_COLORS["text"]};">
    {preview}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_COLORS["page"]};padding:40px 0;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:92%;background:{_COLORS["card"]};border:1px solid {_COLORS["border"]};border-radius:16px;">
          {_header(platform_name, logo_url)}
          <tr><td style="padding:28px 40px 12px;">{content_html}</td></tr>
          {_footer(platform_name, support_email, unsubscribe_url)}
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def render_button(href: str, label: str) -> str:
    """A clean, monochrome call-to-action button (near-black, white label)."""
    return (
        f'<a href="{href}" style="display:inline-block;background:{_COLORS["heading"]};'
        "color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;"
        f'padding:12px 24px;border-radius:10px;">{escape_html(label)}</a>'
    )


def render_heading(text: str) -> str:
    """Body heading. Helper name kept generic for reuse across templates."""
    return (
        '<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:650;'
        f'color:{_COLORS["heading"]};">{escape_html(text)}</h1>'
    )


def render_paragraph(html: str) -> str:
    """A standard body paragraph. ``html`` is inserted as-is (already trusted)."""
    return (
        '<p style="margin:0 0 14px;font-size:14px;line-height:1.65;'
        f'color:{_COLORS["text"]};">{html}</p>'
    )


def render_muted(html: str) -> str:
    """Smaller, muted text (fine print / fallback links)."""
    return (
        '<p style="margin:0;font-size:12px;line-height:1.6;'
        f'color:{_COLORS["muted"]};">{html}</p>'
    )


# Convenience aliases matching the TS helper names (heading/paragraph/muted).
heading = render_heading
paragraph = render_paragraph
muted = render_muted
