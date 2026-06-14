"""Seed a realistic demo for a real-customer dashboard: one completed outbound
campaign on workflow #2 plus ~120 completed call records spread over the last
14 days, with weighted dispositions, durations, costs, Saudi phone numbers and
Arabic contact names. Drives Reports (dispositions/durations), Usage and the
agent run history.

Idempotent-ish: pass --reset to delete previously seeded demo runs/campaign
for workflow #2 before reseeding.

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.seed_demo_campaign
"""

import asyncio
import json
import os
import random
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

ORG_ID = 1
USER_ID = 1
WF_ID = 2
DEF_ID = 2
N_RUNS = 120

random.seed(42)  # reproducible

# disposition -> (weight, (min_dur, max_dur))
DISPOSITIONS = {
    "XFER": (18, (70, 240)),      # transferred to a human / hot lead
    "COMPLETED": (12, (60, 200)),  # handled fully by the agent
    "NI": (25, (18, 70)),          # not interested
    "NA": (20, (4, 14)),           # no answer
    "VM": (12, (6, 20)),           # voicemail
    "CB": (6, (30, 90)),           # callback requested
    "DNC": (4, (8, 30)),           # do not call
    "BUSY": (3, (2, 6)),           # line busy
}
NAMES = [
    "محمد", "أحمد", "عبدالله", "خالد", "سعود", "فهد", "نورة", "سارة", "ريم",
    "العنود", "منيرة", "هند", "لمى", "وجدان", "بدر", "ناصر", "تركي", "ماجد",
    "أمل", "دانة", "روان", "ليان", "يزيد", "سلطان", "مشعل", "غادة",
]
NODES = ["بداية المكالمة", "جدول الأعمال", "إنهاء المكالمة"]


def weighted_choice():
    keys = list(DISPOSITIONS)
    weights = [DISPOSITIONS[k][0] for k in keys]
    return random.choices(keys, weights=weights, k=1)[0]


def saudi_phone() -> str:
    return "+9665" + "".join(random.choices("0123456789", k=8))


async def main():
    reset = "--reset" in sys.argv
    eng = create_async_engine(os.environ["DATABASE_URL"])
    now = datetime.now(UTC)

    async with eng.begin() as c:
        if reset:
            await c.execute(
                text(
                    "delete from workflow_runs where workflow_id=:w and campaign_id in "
                    "(select id from campaigns where workflow_id=:w)"
                ),
                {"w": WF_ID},
            )
            await c.execute(
                text("delete from campaigns where workflow_id=:w"), {"w": WF_ID}
            )
            print("reset: cleared prior demo campaign + runs")

        # 1. Campaign
        processed, failed = 120, 8
        camp_id = (
            await c.execute(
                text(
                    "INSERT INTO campaigns "
                    "(name, organization_id, workflow_id, created_by, source_type, "
                    " source_id, state, total_rows, processed_rows, failed_rows, "
                    " created_at, started_at, completed_at, updated_at, "
                    " rate_limit_per_second, max_retries, source_sync_status, "
                    " retry_config, logs) "
                    "VALUES (:name, :org, :wf, :uid, 'csv', 'demo-leads.csv', "
                    " 'completed'::campaign_state, :total, :proc, :fail, "
                    " :created, :started, :completed, now(), 2, 2, 'synced', "
                    " :retry, :logs) RETURNING id"
                ),
                {
                    "name": "حملة بطاقات الراجحي — العملاء المحتملون",
                    "org": ORG_ID,
                    "wf": WF_ID,
                    "uid": USER_ID,
                    "total": processed,
                    "proc": processed,
                    "fail": failed,
                    "created": now - timedelta(days=12),
                    "started": now - timedelta(days=12, hours=-1),
                    "completed": now - timedelta(days=1),
                    "retry": json.dumps({"max_retries": 2, "retry_delay_seconds": 300}),
                    "logs": json.dumps([]),
                },
            )
        ).scalar()
        print(f"created campaign id={camp_id}")

        # 2. Call records
        counts = {}
        for i in range(N_RUNS):
            disp = weighted_choice()
            counts[disp] = counts.get(disp, 0) + 1
            lo, hi = DISPOSITIONS[disp][1]
            duration = random.randint(lo, hi)
            # spread across last 14 days, business hours, weighted recent
            day = int(abs(random.gauss(0, 5))) % 14
            created = (now - timedelta(days=day)).replace(
                hour=random.randint(9, 19), minute=random.randint(0, 59),
                second=random.randint(0, 59), microsecond=0,
            )
            phone = saudi_phone()
            name = random.choice(NAMES)
            answered = disp not in ("NA", "BUSY")
            tokens = int(duration * random.uniform(28, 42)) if answered else 0
            visited = NODES[: (3 if disp in ("XFER", "COMPLETED") else 2 if answered else 1)]
            gathered = {
                "mapped_call_disposition": disp,
                "customer_phone_number": phone,
                "nodes_visited": visited,
            }
            usage = {"call_duration_seconds": duration}
            cost = {
                "dograh_token_usage": tokens,
                "call_duration_seconds": duration,
            }
            initial = {"phone_number": phone, "name": name}
            await c.execute(
                text(
                    "INSERT INTO workflow_runs "
                    "(name, workflow_id, mode, created_at, is_completed, "
                    " usage_info, cost_info, initial_context, gathered_context, "
                    " annotations, logs, definition_id, campaign_id, "
                    " storage_backend, state, call_type) "
                    "VALUES (:name, :wf, 'twilio', :created, true, "
                    " :usage, :cost, :initial, :gathered, '{}'::json, '{}'::json, "
                    " :defid, :camp, "
                    " 'minio'::storage_backend, 'completed'::workflow_run_state, "
                    " 'outbound'::workflow_call_type)"
                ),
                {
                    "name": f"{name} — {phone}",
                    "wf": WF_ID,
                    "created": created,
                    "usage": json.dumps(usage),
                    "cost": json.dumps(cost),
                    "initial": json.dumps(initial, ensure_ascii=False),
                    "gathered": json.dumps(gathered, ensure_ascii=False),
                    "defid": DEF_ID,
                    "camp": camp_id,
                },
            )

        # 3. A handful of recent inbound browser test runs for variety
        for _ in range(6):
            duration = random.randint(40, 160)
            created = now - timedelta(hours=random.randint(1, 60))
            gathered = {
                "mapped_call_disposition": random.choice(["COMPLETED", "XFER", "NI"]),
                "nodes_visited": NODES,
            }
            await c.execute(
                text(
                    "INSERT INTO workflow_runs "
                    "(name, workflow_id, mode, created_at, is_completed, usage_info, "
                    " cost_info, initial_context, gathered_context, annotations, logs, "
                    " definition_id, storage_backend, state, call_type) "
                    "VALUES (:name, :wf, 'webrtc', :created, true, :usage, :cost, "
                    " '{}'::json, :gathered, '{}'::json, '{}'::json, :defid, "
                    " 'minio'::storage_backend, "
                    " 'completed'::workflow_run_state, 'inbound'::workflow_call_type)"
                ),
                {
                    "name": "اختبار عبر المتصفح",
                    "wf": WF_ID,
                    "created": created,
                    "usage": json.dumps({"call_duration_seconds": duration}),
                    "cost": json.dumps({"dograh_token_usage": duration * 35,
                                        "call_duration_seconds": duration}),
                    "gathered": json.dumps(gathered, ensure_ascii=False),
                    "defid": DEF_ID,
                },
            )

    await eng.dispose()
    total_min = "~"
    print(f"\nseeded {N_RUNS} campaign calls + 6 inbound tests")
    print("disposition mix:", dict(sorted(counts.items(), key=lambda x: -x[1])))
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
