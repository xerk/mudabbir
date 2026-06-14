"""Create a draft version for demo workflow #2 so the in-editor tester is
enabled (it tests the draft; with only a published version it shows
"save draft before testing"). Draft mirrors the published definition.

Run:
  source venv/bin/activate && set -a && source api/.env && set +a \
    && python -m scripts.add_demo_draft
"""

import asyncio

from sqlalchemy import select

from api.db import db_client
from api.db.models import WorkflowDefinitionModel, WorkflowModel

WF_ID = 2


async def main():
    async with db_client.async_session() as session:
        wf = (
            await session.execute(select(WorkflowModel).where(WorkflowModel.id == WF_ID))
        ).scalars().first()
        pub = (
            await session.execute(
                select(WorkflowDefinitionModel).where(
                    WorkflowDefinitionModel.workflow_id == WF_ID,
                    WorkflowDefinitionModel.status == "published",
                )
            )
        ).scalars().first()
        existing_draft = (
            await session.execute(
                select(WorkflowDefinitionModel).where(
                    WorkflowDefinitionModel.workflow_id == WF_ID,
                    WorkflowDefinitionModel.status == "draft",
                )
            )
        ).scalars().first()
        if existing_draft:
            print("draft already exists; nothing to do")
            return
        wf_json = pub.workflow_json
        wf_configs = pub.workflow_configurations
        wf_tcv = pub.template_context_variables

    draft = await db_client.save_workflow_draft(
        workflow_id=WF_ID,
        workflow_definition=wf_json,
        workflow_configurations=wf_configs,
        template_context_variables=wf_tcv,
    )
    # capture before session/commit expiry
    print("draft created for workflow", WF_ID)


if __name__ == "__main__":
    asyncio.run(main())
