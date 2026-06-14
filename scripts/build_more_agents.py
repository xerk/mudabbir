"""Build the نورة and وجدان demo agents the PROPER way (create_workflow ->
published v1 + released pointer, plus a draft so the tester is enabled),
wire ambient noise, and seed a campaign + call records for each.

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.build_more_agents
"""

import asyncio
import json
import os
import random
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine

from api.constants import (
    DEFAULT_CAMPAIGN_RETRY_CONFIG, MINIO_ACCESS_KEY, MINIO_BUCKET,
    MINIO_ENDPOINT, MINIO_PUBLIC_ENDPOINT, MINIO_SECRET_KEY, MINIO_SECURE,
)
from api.db import db_client
from api.db.models import WorkflowDefinitionModel, WorkflowModel
from api.services.filesystem import MinioFileSystem

ORG_ID, USER_ID, TEMPLATE_WF_ID = 1, 1, 1
ASSETS = "/home/xerk/code/domais/v3/assets"
V3_DB = "/home/xerk/code/domais/v3/assets/database.json"
PRESETS = ["نورة", "وجدان"]

random.seed(7)
DISPOSITIONS = {
    "XFER": (18, (70, 240)), "COMPLETED": (12, (60, 200)), "NI": (25, (18, 70)),
    "NA": (20, (4, 14)), "VM": (12, (6, 20)), "CB": (6, (30, 90)),
    "DNC": (4, (8, 30)), "BUSY": (3, (2, 6)),
}
NAMES = ["محمد", "أحمد", "عبدالله", "نورة", "سارة", "ريم", "خالد", "فهد",
         "منيرة", "هند", "بدر", "ناصر", "دانة", "روان", "سلطان", "غادة"]
NODES = ["بداية المكالمة", "جدول الأعمال", "إنهاء المكالمة"]


def s(v):
    if v is None: return ""
    return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, indent=1)


def build_prompts(preset):
    ci = preset.get("core_identity", {})
    name = ci.get("name", "الوكيل")
    global_prompt = "\n\n".join(x for x in [
        f"# الهوية الأساسية\n\n## الاسم\n{name}",
        f"## الدور\n{s(ci.get('role'))}",
        s(ci.get("tone")), s(ci.get("speech_style")),
        (f"## اللهجة\n{s(ci.get('dialect'))}" if ci.get("dialect") else ""),
        (f"# ضوابط السلوك\n\n{s(preset.get('behavioral_guardrails'))}" if preset.get("behavioral_guardrails") else ""),
        (f"# المعرفة\n\n{s(preset.get('knowledge'))}" if preset.get("knowledge") else ""),
    ] if x).strip()
    greeting = s(preset.get("greeting")).strip()
    start_prompt = ("# نقطة العمل الرئيسية في هذه المرحلة\n\n"
                    "لقد استقبلتِ مكالمة من العميل. رحّبي به بجملة افتتاحية واحدة طبيعية.\n"
                    + (f"\nالافتتاحية المقترحة:\n{greeting}\n" if greeting else "")
                    + "\nاستخدمي أول دور أو دورين لفهم العميل، ثم انتقلي إلى جدول الأعمال.")
    agenda_prompt = ("# جدول الأعمال الرئيسي\n\n"
                     "تعاملي مع طلب العميل بناءً على معرفتك ودورك.\n\n"
                     + (f"## مسار المحادثة\n{s(preset.get('state_machine'))}" if preset.get("state_machine") else "")).strip()
    return name, global_prompt, start_prompt, agenda_prompt


def make_graph(template_json, name, global_prompt, start_prompt, agenda_prompt):
    wd = json.loads(json.dumps(template_json))
    for n in wd["nodes"]:
        t = n.get("type")
        if t == "globalNode":
            n["data"]["prompt"], n["data"]["name"] = global_prompt, "الهوية العامة"
        elif t == "startCall":
            n["data"]["prompt"], n["data"]["name"] = start_prompt, "بداية المكالمة"
        elif t == "agentNode":
            n["data"]["prompt"], n["data"]["name"] = agenda_prompt, "جدول الأعمال"
        elif t == "endCall":
            n["data"]["prompt"], n["data"]["name"] = "أنهي المكالمة بلباقة واشكري العميل.", "إنهاء المكالمة"
    return wd


def fs():
    return MinioFileSystem(endpoint=MINIO_ENDPOINT, access_key=MINIO_ACCESS_KEY,
                           secret_key=MINIO_SECRET_KEY, bucket_name=MINIO_BUCKET,
                           secure=MINIO_SECURE, public_endpoint=MINIO_PUBLIC_ENDPOINT)


async def seed_runs(eng, wf_id, def_id, camp_id, n=70):
    now = datetime.now(UTC)
    keys = list(DISPOSITIONS); weights = [DISPOSITIONS[k][0] for k in keys]
    async with eng.begin() as c:
        for _ in range(n):
            disp = random.choices(keys, weights=weights, k=1)[0]
            lo, hi = DISPOSITIONS[disp][1]; dur = random.randint(lo, hi)
            day = int(abs(random.gauss(0, 5))) % 14
            created = (now - timedelta(days=day)).replace(
                hour=random.randint(9, 19), minute=random.randint(0, 59), second=0, microsecond=0)
            phone = "+9665" + "".join(random.choices("0123456789", k=8))
            answered = disp not in ("NA", "BUSY")
            tokens = int(dur * random.uniform(28, 42)) if answered else 0
            gathered = {"mapped_call_disposition": disp, "customer_phone_number": phone,
                        "nodes_visited": NODES[:3 if disp in ("XFER", "COMPLETED") else 2 if answered else 1]}
            await c.execute(text(
                "INSERT INTO workflow_runs (name, workflow_id, mode, created_at, is_completed, "
                "usage_info, cost_info, initial_context, gathered_context, annotations, logs, "
                "definition_id, campaign_id, storage_backend, state, call_type) VALUES "
                "(:name,:wf,'twilio',:created,true,:usage,:cost,:initial,:gathered,'{}'::json,'{}'::json,"
                ":defid,:camp,'minio'::storage_backend,'completed'::workflow_run_state,'outbound'::workflow_call_type)"),
                {"name": f"{random.choice(NAMES)} — {phone}", "wf": wf_id, "created": created,
                 "usage": json.dumps({"call_duration_seconds": dur}),
                 "cost": json.dumps({"dograh_token_usage": tokens, "call_duration_seconds": dur}),
                 "initial": json.dumps({"phone_number": phone}, ensure_ascii=False),
                 "gathered": json.dumps(gathered, ensure_ascii=False), "defid": def_id, "camp": camp_id})


async def main():
    presets = json.load(open(V3_DB, encoding="utf-8"))["presets"]
    storage = fs()
    eng = create_async_engine(os.environ["DATABASE_URL"])

    # template graph from workflow #1
    async with db_client.async_session() as session:
        tmpl = (await session.execute(
            select(WorkflowModel).where(WorkflowModel.id == TEMPLATE_WF_ID))).scalars().first()
        template_json = json.loads(json.dumps(tmpl.workflow_definition))

    for pname in PRESETS:
        # skip if already built
        async with db_client.async_session() as session:
            exists = (await session.execute(
                select(WorkflowModel).where(WorkflowModel.organization_id == ORG_ID,
                                            WorkflowModel.name.like(f"%{pname}%")))).scalars().first()
        if exists:
            print(f"[{pname}] already exists (wf #{exists.id}); skipping")
            continue

        name, gp, sp, ap = build_prompts(presets[pname])
        graph = make_graph(template_json, name, gp, sp, ap)
        wf_name = f"{name} — وكيل تجريبي"

        wf = await db_client.create_workflow(
            name=wf_name, workflow_definition=graph, user_id=USER_ID, organization_id=ORG_ID)
        wf_id = wf.id

        # ambient noise (per-workflow key) + configs on row, published def, and draft
        amb_key = f"ambient-noise/{ORG_ID}/{wf_id}/ambiance_2.mp3"
        await storage.aupload_file(os.path.join(ASSETS, "ambiance_2.mp3"), amb_key)
        configs = {"ambient_noise_configuration": {
            "enabled": True, "volume": 0.25, "storage_key": amb_key,
            "storage_backend": "minio", "filename": "ambiance_2.mp3"}}

        await db_client.save_workflow_draft(
            workflow_id=wf_id, workflow_definition=graph,
            workflow_configurations=configs, template_context_variables={})

        async with eng.begin() as c:
            await c.execute(text("UPDATE workflows SET workflow_configurations=:wc WHERE id=:id"),
                            {"wc": json.dumps(configs), "id": wf_id})
            await c.execute(text("UPDATE workflow_definitions SET workflow_configurations=:wc "
                                 "WHERE workflow_id=:id"), {"wc": json.dumps(configs), "id": wf_id})
            def_id = (await c.execute(text(
                "SELECT id FROM workflow_definitions WHERE workflow_id=:id AND status='published'"),
                {"id": wf_id})).scalar()
            now = datetime.now(UTC)
            camp_id = (await c.execute(text(
                "INSERT INTO campaigns (name, organization_id, workflow_id, created_by, source_type, "
                "source_id, state, total_rows, processed_rows, failed_rows, created_at, started_at, "
                "completed_at, updated_at, rate_limit_per_second, max_retries, source_sync_status, "
                "retry_config, orchestrator_metadata, logs) VALUES "
                "(:name,:org,:wf,:uid,'csv','demo-leads.csv','completed'::campaign_state,:t,:t,:f,"
                ":cr,:st,:cp,now(),2,2,'synced',:retry,'{}'::json,'[]'::json) RETURNING id"),
                {"name": f"حملة {name} التجريبية", "org": ORG_ID, "wf": wf_id, "uid": USER_ID,
                 "t": 70, "f": 5, "cr": now - timedelta(days=10), "st": now - timedelta(days=10),
                 "cp": now - timedelta(days=1),
                 "retry": json.dumps(DEFAULT_CAMPAIGN_RETRY_CONFIG)})).scalar()

        await seed_runs(eng, wf_id, def_id, camp_id, n=70)
        print(f"[{pname}] wf #{wf_id} '{wf_name}' | published def #{def_id} | campaign #{camp_id} | 70 runs | /workflow/{wf_id}")

    await eng.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
