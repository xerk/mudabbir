"""One-off: upload v3 demo assets to MinIO and wire the office ambiance audio
into demo workflow #2 as ambient noise.

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.upload_demo_assets
"""

import asyncio
import json
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from api.enums import StorageBackend
from api.services.filesystem import MinioFileSystem
from api.constants import (
    MINIO_ACCESS_KEY,
    MINIO_BUCKET,
    MINIO_ENDPOINT,
    MINIO_PUBLIC_ENDPOINT,
    MINIO_SECRET_KEY,
    MINIO_SECURE,
)

ORG_ID = 1
WF_ID = 2
ASSETS = "/home/xerk/code/domais/v3/assets"

# Short office-ambiance loop wired as the agent's ambient noise.
AMBIENT_FILE = "ambiance_2.mp3"
AMBIENT_KEY = f"ambient-noise/{ORG_ID}/{WF_ID}/{AMBIENT_FILE}"

# Other demo assets stored under a demo-assets prefix for availability.
OTHER_ASSETS = [
    "lady_2.png",
    "agent_aa32e0a67636e578.png",
    "agent_b4951655a2b32ad2.png",
    "agent_d0c42a52b3b502b3.png",
    "wallpaper.jpg",
    "ringtone.mp3",
    "typing.mp3",
    "ambiance_3.mp3",
]


def storage() -> MinioFileSystem:
    return MinioFileSystem(
        endpoint=MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        bucket_name=MINIO_BUCKET,
        secure=MINIO_SECURE,
        public_endpoint=MINIO_PUBLIC_ENDPOINT,
    )


async def main():
    fs = storage()

    # 1. Ambient noise audio
    ok = await fs.aupload_file(os.path.join(ASSETS, AMBIENT_FILE), AMBIENT_KEY)
    url = await fs.aget_signed_url(AMBIENT_KEY)
    print(f"[ambient] {AMBIENT_FILE} -> {AMBIENT_KEY}  ok={ok}\n          {url}")

    # 2. Other assets
    for name in OTHER_ASSETS:
        path = os.path.join(ASSETS, name)
        if not os.path.exists(path):
            print(f"[skip] missing {name}")
            continue
        key = f"demo-assets/{ORG_ID}/{name}"
        ok = await fs.aupload_file(path, key)
        u = await fs.aget_signed_url(key)
        print(f"[asset] {name} -> {key}  ok={ok}\n        {u}")

    # 3. Wire ambient noise into workflow #2 configurations
    eng = create_async_engine(os.environ["DATABASE_URL"])
    async with eng.begin() as c:
        wc = (
            await c.execute(
                text("select workflow_configurations from workflows where id=:id"),
                {"id": WF_ID},
            )
        ).scalar() or {}
        wc = json.loads(json.dumps(wc))
        wc["ambient_noise_configuration"] = {
            "enabled": True,
            "volume": 0.25,
            "storage_key": AMBIENT_KEY,
            "storage_backend": StorageBackend.MINIO.value,
            "filename": AMBIENT_FILE,
        }
        await c.execute(
            text(
                "update workflows set workflow_configurations = :wc where id = :id"
            ),
            {"wc": json.dumps(wc), "id": WF_ID},
        )
        print(f"\n[wired] ambient_noise_configuration set on workflow #{WF_ID}")
    await eng.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
