"""Fix demo workflow #2: it was created via raw SQL into the legacy
``workflow_definition`` column but had no row in ``workflow_definitions``
(the versioned table the API reads), so the editor 404s. This creates the
published v1 definition (mirroring db_client.create_workflow) and links it.

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.fix_demo_agent_definition
"""

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select

from api.db import db_client
from api.db.models import WorkflowDefinitionModel, WorkflowModel

WF_ID = 2


async def main():
    async with db_client.async_session() as session:
        wf = (
            await session.execute(
                select(WorkflowModel).where(WorkflowModel.id == WF_ID)
            )
        ).scalars().first()
        if wf is None:
            raise SystemExit(f"workflow {WF_ID} not found")

        existing = (
            await session.execute(
                select(WorkflowDefinitionModel).where(
                    WorkflowDefinitionModel.workflow_id == WF_ID
                )
            )
        ).scalars().all()
        if existing:
            print(f"workflow {WF_ID} already has {len(existing)} definition(s); aborting")
            return

        wc = wf.workflow_configurations or {}
        definition = WorkflowDefinitionModel(
            workflow_json=wf.workflow_definition,
            workflow_id=wf.id,
            is_current=True,
            status="published",
            version_number=1,
            published_at=datetime.now(UTC),
            workflow_configurations=wc,
            template_context_variables=wf.template_context_variables or {},
        )
        session.add(definition)
        await session.flush()
        wf.released_definition_id = definition.id
        await session.commit()
        print(
            f"Created published definition id={definition.id} for workflow {WF_ID}; "
            f"released_definition_id set. ambient_noise in configs: "
            f"{'ambient_noise_configuration' in wc}"
        )


if __name__ == "__main__":
    asyncio.run(main())
