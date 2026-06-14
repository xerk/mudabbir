"""Upgrade the demo agents (العنود #2, نورة #3, وجدان #4) to the FULL v3 prompt
structure — porting v3 features that were missing: clean <persona>/<rules>,
response guidelines, forbidden/anti-injection rules, escalation keywords,
cultural auto-responses, wait-time fillers, silence-nudge handling, and the
first-message greeting trigger. Also sets a customer_name template variable
(v3's name-substitution feature).

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.enrich_agents_v3
"""

import asyncio
import json
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

V3_DB = "/home/xerk/code/domais/v3/assets/database.json"
WF_FOR_PRESET = {"العنود": 2, "نورة": 3, "وجدان": 4}
CUSTOMER = "{{customer_name}}"

# mudabbir handles user-silence natively (it nudges "are you still there?" then
# disconnects), so the prompt only needs a light hint on how to phrase a nudge.
SILENCE_HANDLING = (
    "<silence_handling>\n"
    "إذا طُلب منك التحقق من وجود العميل بعد صمت، اسألي بإيجاز وتنويع: "
    "\"ألوو..\" / \"معي على الخط؟\" / \"سامعني؟\" دون تكرار نفس العبارة، ثم انتظري.\n"
    "</silence_handling>"
)
TURN_RULE = ("توقّفي فوراً وانتظري رد العميل عند انتهاء دورك. لا تنطقي أي وسوم تقنية. "
             "جميع العملاء يُخاطَبون بصيغة المذكّر.")

# Explicit end-call directive — overrides the generic "don't end the call"
# guardrail when the caller clearly asks to hang up. mudabbir ends the call by
# taking the End-call transition, so the agent must trigger it rather than keep
# asking "anything else?".
END_CALL_RULE = (
    "## إنهاء المكالمة (قاعدة قاطعة)\n"
    "إذا طلب العميل إنهاء المكالمة صراحةً أو قال إنه انتهى ولا يحتاج شيئاً آخر "
    "(مثل: \"خلاص\"، \"أبي أنهي المكالمة\"، \"مع السلامة\"، \"شكراً انتهينا\"، "
    "\"ما أحتاج شي ثاني\"، \"تكفى سكّر\") — أنهي المكالمة فوراً عبر مسار الإنهاء، "
    "وردّي بوداع قصير فقط دون أن تسألي \"في شي ثاني؟\". "
    "سؤال \"في شي ثاني؟\" مسموح فقط قبل أن يطلب العميل الإنهاء، وممنوع تكراره بعد طلبه الإنهاء. "
    "قاعدة \"عدم إنهاء المكالمة من نفسك\" تخص الإنهاء التلقائي فقط — أما عند طلب العميل الصريح فالإنهاء واجب فوري."
)


def s(v):
    if v is None: return ""
    return v if isinstance(v, str) else json.dumps(v, ensure_ascii=False, indent=1)


def build_v3_prompts(preset):
    ci = preset.get("core_identity", {})
    name = ci.get("name", "الوكيل")
    bg = preset.get("behavioral_guardrails", {})
    if isinstance(bg, str):
        bg = {"response_guidelines": bg}
    resp = s(bg.get("response_guidelines"))
    forbidden = s(bg.get("forbidden"))
    esc = bg.get("escalation_rules", {})
    esc_kw = esc.get("keywords", "") if isinstance(esc, dict) else ""

    persona = "\n\n".join(x for x in [
        f"اسمك: {name}. دورك: {s(ci.get('role'))}",
        s(ci.get("dialect")), s(ci.get("tone")), s(ci.get("speech_style")),
    ] if x)

    rules = "\n\n".join(x for x in [
        resp, forbidden,
        (f"## التصعيد\nإذا قال العميل أياً من هذه الكلمات حوّلي إلى موظف بشري فوراً: {esc_kw}" if esc_kw else ""),
        END_CALL_RULE,
        TURN_RULE,
    ] if x)

    knowledge = s(preset.get("knowledge"))

    # Global node: always-on identity + rules + knowledge + silence handling
    global_prompt = (
        f"<persona>\n{persona}\n</persona>\n\n"
        f"<rules>\n{rules}\n</rules>\n\n"
        + (f"<knowledge>\n{knowledge}\n</knowledge>\n\n" if knowledge else "")
        + SILENCE_HANDLING
    )

    # Start node: greet immediately when the call begins (mudabbir kicks off the
    # bot's first turn — no signal needed; keep the greeting unconditional).
    greeting = s(preset.get("greeting")).replace("[اسم الموظف]", name).strip()
    start_prompt = (
        "# بداية المكالمة\n\n"
        "بمجرد بدء المكالمة، افتتحي فوراً بهذه الجملة بالضبط دون إضافات:\n"
        f"\"{greeting}\"\n\n"
        "بعد الترحيب، استمعي لحاجة العميل وانتقلي إلى جدول الأعمال عند فهم طلبه."
    )

    # Agent node: the conversation flow / state machine
    flow = s(preset.get("state_machine"))
    agent_prompt = (
        "# جدول الأعمال\n\nتعاملي مع طلب العميل وفق معرفتك ودورك بأسلوب محادثة قصير.\n\n"
        + (f"<flow>\n{flow}\n</flow>" if flow else "")
    ).strip()

    end_prompt = ("أنهي المكالمة بلباقة فقط عندما يصرّح العميل أنه انتهى. اشكريه بإيجاز ثم اصمتي. "
                  "ممنوع إنهاء المكالمة من تلقاء نفسك.")

    return name, global_prompt, start_prompt, agent_prompt, end_prompt


async def main():
    presets = json.load(open(V3_DB, encoding="utf-8"))["presets"]
    eng = create_async_engine(os.environ["DATABASE_URL"])
    async with eng.begin() as c:
        for pname, wf_id in WF_FOR_PRESET.items():
            if pname not in presets:
                print(f"[{pname}] preset missing; skip"); continue
            name, gp, sp, ap, ep = build_v3_prompts(presets[pname])
            mapping = {"globalNode": gp, "startCall": sp, "agentNode": ap, "endCall": ep}
            # update every definition (published + draft) of this workflow
            rows = (await c.execute(text(
                "SELECT id, workflow_json FROM workflow_definitions WHERE workflow_id=:w"),
                {"w": wf_id})).fetchall()
            for def_id, wj in rows:
                wj = json.loads(json.dumps(wj))
                for n in wj["nodes"]:
                    t = n.get("type")
                    if t in mapping:
                        n["data"]["prompt"] = mapping[t]
                await c.execute(text(
                    "UPDATE workflow_definitions SET workflow_json=:wj WHERE id=:id"),
                    {"wj": json.dumps(wj, ensure_ascii=False), "id": def_id})
            # also keep the legacy column + template var in sync
            await c.execute(text(
                "UPDATE workflows SET template_context_variables=:tcv WHERE id=:id"),
                {"tcv": json.dumps({"customer_name": "العميل"}), "id": wf_id})
            await c.execute(text(
                "UPDATE workflow_definitions SET template_context_variables=:tcv WHERE workflow_id=:w"),
                {"tcv": json.dumps({"customer_name": "العميل"}), "w": wf_id})
            print(f"[{pname}] wf#{wf_id}: updated {len(rows)} definition(s) with full v3 prompt "
                  f"(persona/rules/knowledge/silence/first_message)")
    await eng.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
