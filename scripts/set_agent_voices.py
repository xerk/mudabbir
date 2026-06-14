"""Give نورة (#3) and وجدان (#4) their v3 voice (Leda) via per-workflow model
overrides — merged onto the org realtime config (keeps the Gemini key/model,
only changes the voice). Sets it on the workflow row + every definition so test
and campaign runs both pick it up. Verifies the effective config resolves.

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.set_agent_voices
"""

import asyncio
import json
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from api.services.configuration.ai_model_configuration import (
    get_effective_ai_model_configuration_for_workflow,
)

VOICE_BY_WF = {3: "Leda", 4: "Leda"}  # نورة, وجدان


async def main():
    eng = create_async_engine(os.environ["DATABASE_URL"])
    async with eng.begin() as c:
        for wf_id, voice in VOICE_BY_WF.items():
            override = {"realtime": {"voice": voice}}
            # merge into workflow row configs
            row = (await c.execute(text(
                "SELECT workflow_configurations FROM workflows WHERE id=:id"),
                {"id": wf_id})).scalar() or {}
            row = json.loads(json.dumps(row))
            row["model_overrides"] = override
            await c.execute(text(
                "UPDATE workflows SET workflow_configurations=:wc WHERE id=:id"),
                {"wc": json.dumps(row, ensure_ascii=False), "id": wf_id})
            # merge into every definition's configs
            defs = (await c.execute(text(
                "SELECT id, workflow_configurations FROM workflow_definitions WHERE workflow_id=:w"),
                {"w": wf_id})).fetchall()
            for def_id, wc in defs:
                wc = json.loads(json.dumps(wc or {}))
                wc["model_overrides"] = override
                await c.execute(text(
                    "UPDATE workflow_definitions SET workflow_configurations=:wc WHERE id=:id"),
                    {"wc": json.dumps(wc, ensure_ascii=False), "id": def_id})
            print(f"[wf#{wf_id}] set realtime voice override -> {voice} ({len(defs)} defs)")
    await eng.dispose()

    # verify the effective config resolves with the new voice
    for wf_id, voice in VOICE_BY_WF.items():
        eng2 = create_async_engine(os.environ["DATABASE_URL"])
        async with eng2.connect() as c:
            wc = (await c.execute(text(
                "SELECT workflow_configurations FROM workflow_definitions "
                "WHERE workflow_id=:w AND status='published'"), {"w": wf_id})).scalar()
        eff = await get_effective_ai_model_configuration_for_workflow(
            user_id=1, organization_id=1, workflow_configurations=wc)
        rt_voice = getattr(eff.realtime, "voice", None)
        print(f"[verify wf#{wf_id}] effective realtime voice = {rt_voice} "
              f"(model={getattr(eff.realtime,'model',None)})")
        await eng2.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
