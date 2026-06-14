"""One-off: build a demo voice agent (workflow) for org #1 by cloning the
existing workflow #1 graph structure and injecting the v3 "العنود" preset
persona (Al-Rajhi bank cards sales agent, Arabic).

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.build_demo_agent
"""

import asyncio
import json
import os
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

ORG_ID = 1
USER_ID = 1
TEMPLATE_WF_ID = 1


def s(v) -> str:
    """Coerce a preset field (str or dict/list) to text."""
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    return json.dumps(v, ensure_ascii=False, indent=1)


def build_prompts(preset: dict):
    ci = preset.get("core_identity", {})
    name = ci.get("name", "الوكيل")
    global_prompt = "\n\n".join(
        x
        for x in [
            f"# الهوية الأساسية\n\n## الاسم\n{name}",
            f"## الدور\n{s(ci.get('role'))}",
            s(ci.get("tone")),
            s(ci.get("speech_style")),
            (f"## اللهجة\n{s(ci.get('dialect'))}" if ci.get("dialect") else ""),
            (
                f"# ضوابط السلوك\n\n{s(preset.get('behavioral_guardrails'))}"
                if preset.get("behavioral_guardrails")
                else ""
            ),
            (
                f"# المعرفة\n\n{s(preset.get('knowledge'))}"
                if preset.get("knowledge")
                else ""
            ),
        ]
        if x
    ).strip()

    greeting = s(preset.get("greeting")).strip()
    start_prompt = (
        "# نقطة العمل الرئيسية في هذه المرحلة\n\n"
        "لقد استقبلتِ مكالمة من العميل. رحّبي به بشكل طبيعي بجملة افتتاحية واحدة.\n"
        + (f"\nالافتتاحية المقترحة:\n{greeting}\n" if greeting else "")
        + "\nاستخدمي أول دور أو دورين لفهم من المتصل وما يحتاجه، ثم انتقلي إلى جدول الأعمال الرئيسي."
    )

    agenda_prompt = (
        "# جدول الأعمال الرئيسي\n\n"
        "تعاملي مع طلب العميل بناءً على معرفتك ودورك. اطرحي أسئلة قصيرة عند الحاجة.\n\n"
        + (
            f"## مسار المحادثة\n{s(preset.get('state_machine'))}"
            if preset.get("state_machine")
            else ""
        )
    ).strip()

    return name, global_prompt, start_prompt, agenda_prompt


async def main():
    preset = json.load(open("/tmp/preset_anoud.json", encoding="utf-8"))
    name, global_prompt, start_prompt, agenda_prompt = build_prompts(preset)

    eng = create_async_engine(os.environ["DATABASE_URL"])
    async with eng.begin() as c:
        tmpl = (
            await c.execute(
                text(
                    "select workflow_definition, template_context_variables, "
                    "call_disposition_codes, status from workflows where id=:id"
                ),
                {"id": TEMPLATE_WF_ID},
            )
        ).fetchone()
        wd = json.loads(json.dumps(tmpl[0]))  # deep copy
        tcv, cdc, status = tmpl[1], tmpl[2], tmpl[3]

        # Inject persona into the cloned graph, preserving all structural fields.
        for n in wd["nodes"]:
            t = n.get("type")
            if t == "globalNode":
                n["data"]["prompt"] = global_prompt
                n["data"]["name"] = "الهوية العامة"
            elif t == "startCall":
                n["data"]["prompt"] = start_prompt
                n["data"]["name"] = "بداية المكالمة"
            elif t == "agentNode":
                n["data"]["prompt"] = agenda_prompt
                n["data"]["name"] = "جدول الأعمال"
            elif t == "endCall":
                n["data"]["prompt"] = (
                    "أنهي المكالمة بلباقة. اشكري العميل وقدّمي خاتمة قصيرة."
                )
                n["data"]["name"] = "إنهاء المكالمة"

        wf_uuid = str(uuid.uuid4())
        wf_name = f"{name} — تجربة بطاقات الراجحي"
        new_id = (
            await c.execute(
                text(
                    "INSERT INTO workflows "
                    "(name, workflow_definition, created_at, user_id, "
                    " template_context_variables, call_disposition_codes, "
                    " organization_id, status, workflow_configurations, workflow_uuid) "
                    "VALUES (:name, :wd, now(), :uid, :tcv, :cdc, :org, :status, :wc, :uuid) "
                    "RETURNING id"
                ),
                {
                    "name": wf_name,
                    "wd": json.dumps(wd, ensure_ascii=False),
                    "uid": USER_ID,
                    "tcv": json.dumps(tcv if tcv is not None else {}),
                    "cdc": json.dumps(cdc if cdc is not None else []),
                    "org": ORG_ID,
                    "status": status,
                    "wc": json.dumps({}),
                    "uuid": wf_uuid,
                },
            )
        ).scalar()
        print(f"Created workflow id={new_id} name={wf_name!r} uuid={wf_uuid}")
        print(f"Open at: /workflow/{new_id}")
    await eng.dispose()


if __name__ == "__main__":
    asyncio.run(main())
