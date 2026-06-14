"""Make the 'End call' transitions fire when the caller explicitly asks to end
the call (in Arabic or English), not only when the issue is 'fully handled'.
Applies to العنود #2, نورة #3, وجدان #4 (published + draft definitions).

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.fix_endcall_conditions
"""

import asyncio
import json
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

WF_IDS = [2, 3, 4]
END_NODE_ID = "4"

END_CONDITION = (
    "اسلكي هذا المسار فوراً عندما يطلب العميل إنهاء المكالمة أو يودّع أو يقول إنه "
    "انتهى ولا يحتاج شيئاً آخر — مثل: \"أنهِ المكالمة\"، \"خلاص\"، \"خلصنا\"، "
    "\"مع السلامة\"، \"شكراً انتهينا\"، \"ما أحتاج شي ثاني\"، \"تكفى سكّر\" — "
    "أو عندما يُحلّ طلبه بالكامل ولا يوجد لديه شيء آخر. "
    "Take this pathway immediately when the caller asks to end/hang up the call, "
    "says goodbye, or indicates they are done and need nothing else, OR when the "
    "issue is fully resolved with nothing remaining."
)


async def main():
    eng = create_async_engine(os.environ["DATABASE_URL"])
    async with eng.begin() as c:
        for wf_id in WF_IDS:
            defs = (await c.execute(text(
                "SELECT id, workflow_json FROM workflow_definitions WHERE workflow_id=:w"),
                {"w": wf_id})).fetchall()
            for def_id, wj in defs:
                wj = json.loads(json.dumps(wj))
                changed = 0
                for e in wj.get("edges", []):
                    if str(e.get("target")) == END_NODE_ID:
                        e.setdefault("data", {})
                        e["data"]["condition"] = END_CONDITION
                        e["data"]["label"] = "إنهاء المكالمة"
                        changed += 1
                await c.execute(text(
                    "UPDATE workflow_definitions SET workflow_json=:wj WHERE id=:id"),
                    {"wj": json.dumps(wj, ensure_ascii=False), "id": def_id})
                print(f"  wf#{wf_id} def#{def_id}: updated {changed} end-call edge(s)")
    await eng.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
