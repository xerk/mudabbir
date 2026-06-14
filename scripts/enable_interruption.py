"""Enable barge-in (allow_interrupt=True) on every node of the demo agents so
the caller can interrupt the bot and be heard immediately — fixes the
"Interruption Disabled" banner and the "bot didn't hear me -> nudge -> hang up"
chain. Applies to العنود #2, نورة #3, وجدان #4 (published + draft).

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.enable_interruption
"""

import asyncio
import json
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

WF_IDS = [2, 3, 4]


async def main():
    eng = create_async_engine(os.environ["DATABASE_URL"])
    async with eng.begin() as c:
        for wf_id in WF_IDS:
            defs = (await c.execute(text(
                "SELECT id, workflow_json FROM workflow_definitions WHERE workflow_id=:w"),
                {"w": wf_id})).fetchall()
            for def_id, wj in defs:
                wj = json.loads(json.dumps(wj))
                n_changed = 0
                for node in wj.get("nodes", []):
                    if node.get("data", {}).get("allow_interrupt") is not True:
                        node.setdefault("data", {})["allow_interrupt"] = True
                        n_changed += 1
                await c.execute(text(
                    "UPDATE workflow_definitions SET workflow_json=:wj WHERE id=:id"),
                    {"wj": json.dumps(wj, ensure_ascii=False), "id": def_id})
                print(f"  wf#{wf_id} def#{def_id}: enabled interruption on {n_changed} node(s)")
            # keep the legacy column in sync (editor may read it)
            row = (await c.execute(text(
                "SELECT workflow_definition FROM workflows WHERE id=:id"), {"id": wf_id})).scalar()
            if row:
                row = json.loads(json.dumps(row))
                for node in row.get("nodes", []):
                    node.setdefault("data", {})["allow_interrupt"] = True
                await c.execute(text(
                    "UPDATE workflows SET workflow_definition=:wj WHERE id=:id"),
                    {"wj": json.dumps(row, ensure_ascii=False), "id": wf_id})
    await eng.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
