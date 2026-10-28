CREATE TABLE IF NOT EXISTS workflow_task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "processDefinitionKey" VARCHAR(150) NOT NULL,
  "taskDefinitionKey" VARCHAR(150) NOT NULL,
  "taskName" VARCHAR(200),
  "candidateGroups" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "candidateUsers" JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workflow_task_assignment_process_task
    UNIQUE ("processDefinitionKey", "taskDefinitionKey")
);

CREATE INDEX IF NOT EXISTS ix_workflow_task_assignments_process
  ON workflow_task_assignments("processDefinitionKey");

