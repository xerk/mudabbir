"""One-off: store the Gemini (Google AI Studio) key into org #1's model
configuration as a BYOK realtime config (Gemini Live), validated against the
real pydantic schema before writing.

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.setup_demo_gemini_config
"""

import asyncio
import json
import os
import re
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from api.schemas.ai_model_configuration import OrganizationAIModelConfigurationV2

V3_API_PHP = Path("/home/xerk/code/domais/v3/api.php")
ORG_ID = 1
CONFIG_KEY = "MODEL_CONFIGURATION_V2"


def read_gemini_key() -> str:
    text_ = V3_API_PHP.read_text()
    m = re.search(r"GEMINI_API_KEY\s*=\s*'([^']+)'", text_)
    if not m:
        raise SystemExit("Could not find GEMINI_API_KEY in v3/api.php")
    return m.group(1)


def build_config(gemini_key: str) -> OrganizationAIModelConfigurationV2:
    # BYOK realtime: Gemini Live for speech-to-speech + a Gemini text model for
    # variable extraction / QA. Mirrors the v3 preset (gemini-3.1-flash-live,
    # voice Aoede, Arabic).
    return OrganizationAIModelConfigurationV2.model_validate(
        {
            "version": 2,
            "mode": "byok",
            "byok": {
                "mode": "realtime",
                "realtime": {
                    "realtime": {
                        "provider": "google_realtime",
                        "model": "gemini-3.1-flash-live-preview",
                        "voice": "Aoede",
                        "language": "ar",
                        "api_key": gemini_key,
                    },
                    "llm": {
                        "provider": "google",
                        "model": "gemini-2.5-flash",
                        "api_key": gemini_key,
                    },
                },
            },
        }
    )


async def main():
    gemini_key = read_gemini_key()
    cfg = build_config(gemini_key)
    value = cfg.model_dump(mode="json")
    masked = json.dumps(value)[:120].replace(gemini_key, gemini_key[:6] + "…")
    print("Validated config (masked preview):", masked)

    url = os.environ["DATABASE_URL"]
    eng = create_async_engine(url)
    async with eng.begin() as c:
        res = await c.execute(
            text(
                "UPDATE organization_configurations "
                "SET value = :value, updated_at = now() "
                "WHERE organization_id = :org AND key = :key"
            ),
            {"value": json.dumps(value), "org": ORG_ID, "key": CONFIG_KEY},
        )
        if res.rowcount == 0:
            await c.execute(
                text(
                    "INSERT INTO organization_configurations "
                    "(organization_id, key, value, created_at, updated_at) "
                    "VALUES (:org, :key, :value, now(), now())"
                ),
                {"org": ORG_ID, "key": CONFIG_KEY, "value": json.dumps(value)},
            )
            print("Inserted new MODEL_CONFIGURATION_V2 row for org", ORG_ID)
        else:
            print("Updated MODEL_CONFIGURATION_V2 for org", ORG_ID)
    await eng.dispose()
    print("Done — org #1 now uses BYOK Gemini Live (realtime).")


if __name__ == "__main__":
    asyncio.run(main())
