# mudabbir — roadmap

mudabbir is built **on Dograh as its base** (one project). We own a fork, evolve
it our way over time, add Arabic, extend the org/workspace model, and build our
business features (CRM, planning) as new modules — following Dograh's own
conventions, not our old NestJS/DDD stack.

## Stack (inherited from Dograh)

- **Backend:** Python · FastAPI · async SQLAlchemy · Alembic migrations
- **Background jobs:** **ARQ** on Redis (this is the sanctioned queue — not BullMQ)
- **Frontend:** Next.js 15 · React 19 · TypeScript · Tailwind · shadcn/ui · Zustand
- **Builder:** `@xyflow/react` (`ui/src/components/flow`)
- **Storage:** MinIO (S3-compatible)
- **Remotes:** `origin` = `xerk/dograh` (push) · `upstream` = `dograh-hq/dograh` (pull engine fixes)
- **Submodule:** Pipecat → `xerk/pipecat` (we will modify the engine)

## Conventions (follow these — "our way" now means Dograh's way, cleanly)

- A backend feature = `api/routes/<x>.py` + `api/db/<x>_client.py` + `api/schemas/`
  + an Alembic migration. Async SQLAlchemy; no raw DDL.
- A UI feature = `ui/src/app/<route>` + `ui/src/components/<area>`, shadcn + RHF + Zustand.
- New env vars: `api/.env` / `ui/.env` (+ `.env.example`), never hard-coded.
- Tests hit the test DB via `api/.env.test`. Keep `pytest` + UI lint/types green per phase.

---

## Phases (small, sequential, each testable)

### M0 — Own the fork  *(needs the xerk forks to exist)*
- 0.1 Fork `dograh-hq/dograh` → `xerk/dograh`; `dograh-hq/pipecat` → `xerk/pipecat`.
- 0.2 `origin` → `xerk/dograh`; repoint `.gitmodules` Pipecat → `xerk/pipecat`; verify.
- **Test:** `git remote -v` + `git submodule status` correct; a push to `origin` succeeds.

### M1 — Run from source (clean local dev)
- 1.1 `docker-compose-local.yaml` infra up; Python venv + `api` deps; `ui` deps; `.env` files.
- 1.2 `scripts/start_services_dev.sh` (API) + `ui` next dev; health 200; app on :3000.
- **Test:** sign up → create org → open the workflow builder locally; place a test call.

### M2 — Make it ours (rebrand)
- 2.1 Name / logo / favicon / colors → mudabbir; metadata, mail sender, marketing copy.
- 2.2 Strip telemetry/posthog/sentry defaults we don't want; clean `.env.example`.
- **Test:** app shows mudabbir brand; no outbound telemetry; build/lint clean.

### M3 — Arabic + RTL (step by step)
- 3.1 i18n in `ui` (next-intl) + locale switch + `dir=rtl` + Arabic font.
- 3.2 Salvage Arabic content from `mudabbir.ai`; wire `common`/`nav` first.
- 3.3 Screen-by-screen AR keys (page-by-page sweep).
- **Test:** EN/AR switch; RTL layout correct; key screens translated.

### M4 — Org / workspace model our way
- 4.1 Extend org settings (timezone, currency, date/time format, …) into
  `organization_configuration`; surface in UI.
- 4.2 Review roles/admin/superuser + impersonation for our needs.
- **Test:** settings persist + apply; roles enforced; impersonation gated.

### M5 — Business features as new modules (repeat per feature)
Establish + document the module pattern once, then one small phase per feature:
contacts → companies → pipelines/deals → activities → planning/scheduling → …
- **Test (each):** CRUD via API + UI; migration up/down; pytest + UI checks green.

### M6 — Gradual GraphQL (later, when it earns its keep)
- Add Strawberry GraphQL to FastAPI; expose **new** business modules via GraphQL
  first; migrate incrementally. No big-bang rewrite of Dograh's REST.

### M7 — Retire mudabbir.ai
- Salvage (Arabic content, branding/design tokens, mail templates, org-settings
  ideas); archive the old NestJS repo; mudabbir = this repo.

## Salvage list from the old `mudabbir.ai` repo
- Arabic translations (`apps/web/messages/ar/*`) — reuse as content.
- Branding assets + design tokens / theme.
- Mail templates (clean header/footer) — adapt to Dograh's mailer.
- Org-settings model ideas (regional + security groups).
