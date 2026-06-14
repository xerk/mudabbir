"""Fix the campaign list (bad retry_config) and populate Files (knowledge base
documents) + Recordings for org #1 so /campaigns, /files and /recordings are
no longer empty. Validates each list builder before finishing.

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.seed_files_recordings
"""

import asyncio
import json
import os
import uuid
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine

from api.constants import (
    MINIO_ACCESS_KEY, MINIO_BUCKET, MINIO_ENDPOINT,
    MINIO_PUBLIC_ENDPOINT, MINIO_SECRET_KEY, MINIO_SECURE,
)
from api.db import db_client
from api.db.models import KnowledgeBaseDocumentModel, WorkflowRecordingModel
from api.services.filesystem import MinioFileSystem

ORG_ID, USER_ID, WF_ID = 1, 1, 2
ASSETS = "/home/xerk/code/domais/v3/assets"
V3_DB = "/home/xerk/code/domais/v3/assets/database.json"


def fs():
    return MinioFileSystem(
        endpoint=MINIO_ENDPOINT, access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY, bucket_name=MINIO_BUCKET,
        secure=MINIO_SECURE, public_endpoint=MINIO_PUBLIC_ENDPOINT,
    )


async def fix_campaign(eng):
    from api.constants import DEFAULT_CAMPAIGN_RETRY_CONFIG
    async with eng.begin() as c:
        n = await c.execute(
            text("UPDATE campaigns SET retry_config = :rc, "
                 "orchestrator_metadata = '{}'::json "
                 "WHERE organization_id = :org"),
            {"org": ORG_ID, "rc": json.dumps(DEFAULT_CAMPAIGN_RETRY_CONFIG)},
        )
        print(f"[campaign] fixed retry_config on {n.rowcount} campaign(s)")


async def seed_files(storage):
    presets = json.load(open(V3_DB, encoding="utf-8"))["presets"]
    docs = [
        ("بطاقات الراجحي - معلومات المنتج.txt", presets["العنود"]["knowledge"]),
        ("بيانات العميل النموذجي.txt", presets["وجدان"]["knowledge"]),
    ]
    async with db_client.async_session() as session:
        existing = (await session.execute(
            select(KnowledgeBaseDocumentModel).where(
                KnowledgeBaseDocumentModel.organization_id == ORG_ID)
        )).scalars().all()
        have = {d.filename for d in existing}
        created = 0
        for filename, content in docs:
            if filename in have:
                print(f"[file] exists: {filename}")
                continue
            doc_uuid = str(uuid.uuid4())
            data = content.encode("utf-8")
            key = f"knowledge_base/{ORG_ID}/{doc_uuid}/{filename}"
            import tempfile
            with tempfile.NamedTemporaryFile("wb", delete=False, suffix=".txt") as tf:
                tf.write(data)
                tmp = tf.name
            await storage.aupload_file(tmp, key)
            os.unlink(tmp)
            doc = KnowledgeBaseDocumentModel(
                document_uuid=doc_uuid, organization_id=ORG_ID,
                filename=filename, file_size_bytes=len(data),
                mime_type="text/plain", retrieval_mode="full",
                full_text=content, source_url=key, total_chunks=1,
                processing_status="completed", created_by=USER_ID,
                created_at=datetime.now(UTC), is_active=True,
            )
            session.add(doc)
            created += 1
            print(f"[file] created: {filename} ({len(data)} bytes)")
        await session.commit()
    print(f"[file] {created} document(s) created")


async def seed_recordings(storage):
    # sound assets -> recordings (appear on /recordings page)
    items = [
        ("ambiance_2.mp3", "ضجيج مكتب خلفي للمكالمات", "ambient-noise/1/2/ambiance_2.mp3"),
        ("ringtone.mp3", "نغمة رنين", "demo-assets/1/ringtone.mp3"),
        ("typing.mp3", "صوت كتابة على لوحة المفاتيح", "demo-assets/1/typing.mp3"),
        ("ambiance_3.mp3", "ضجيج محيط بديل", "demo-assets/1/ambiance_3.mp3"),
    ]
    async with db_client.async_session() as session:
        existing = (await session.execute(
            select(WorkflowRecordingModel).where(
                WorkflowRecordingModel.organization_id == ORG_ID)
        )).scalars().all()
        have = {r.transcript for r in existing}
        created = 0
        for fname, transcript, key in items:
            if transcript in have:
                print(f"[rec] exists: {transcript}")
                continue
            rec = WorkflowRecordingModel(
                recording_id=uuid.uuid4().hex[:16],
                workflow_id=WF_ID, organization_id=ORG_ID,
                tts_provider="google", tts_model="gemini-2.5-flash-preview-tts",
                tts_voice_id="Aoede", transcript=transcript,
                storage_key=key, storage_backend="minio",
                recording_metadata={"source": "v3-demo", "filename": fname},
                created_by=USER_ID, created_at=datetime.now(UTC), is_active=True,
            )
            session.add(rec)
            created += 1
            print(f"[rec] created: {transcript}")
        await session.commit()
    print(f"[rec] {created} recording(s) created")


async def validate(eng):
    from api.routes.campaign import _build_campaign_response
    from api.db.models import CampaignModel, KnowledgeBaseDocumentModel, WorkflowRecordingModel
    async with db_client.async_session() as session:
        camps = (await session.execute(
            select(CampaignModel).where(CampaignModel.organization_id == ORG_ID))).scalars().all()
        for c in camps:
            _build_campaign_response(c, "wf")
        docs = (await session.execute(
            select(KnowledgeBaseDocumentModel).where(
                KnowledgeBaseDocumentModel.organization_id == ORG_ID,
                KnowledgeBaseDocumentModel.is_active == True))).scalars().all()
        recs = (await session.execute(
            select(WorkflowRecordingModel).where(
                WorkflowRecordingModel.organization_id == ORG_ID,
                WorkflowRecordingModel.is_active == True))).scalars().all()
    print(f"\n[validate] campaigns={len(camps)} (all build OK) | "
          f"documents={len(docs)} | recordings={len(recs)}")


async def main():
    storage = fs()
    eng = create_async_engine(os.environ["DATABASE_URL"])
    await fix_campaign(eng)
    await seed_files(storage)
    await seed_recordings(storage)
    await validate(eng)
    await eng.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
