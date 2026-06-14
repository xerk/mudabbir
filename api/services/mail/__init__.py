"""Outbound email package.

Public surface:

* :func:`send_email` -- generic "send a rendered email now" helper (used by the
  ARQ processor and any direct sender).

The ARQ producer/processor live in :mod:`api.tasks.mail_tasks` — import
``enqueue_invitation_email`` from there directly. It is intentionally NOT
re-exported here: ``mail_tasks`` imports ``api.services.mail.send``, so
re-exporting it would create a circular import on package initialization.
"""

from api.services.mail.send import send_email

__all__ = ["send_email"]
