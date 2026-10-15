
CREATE TABLE workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  "processDefinitionId" VARCHAR(150) NOT NULL,
  "taskDefinitionKey" VARCHAR(150) NOT NULL,

  code VARCHAR(100) NOT NULL,
  label VARCHAR(150) NOT NULL,

  variables JSONB NOT NULL DEFAULT '{}'::jsonb,

  active BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_workflow_action_definition_task_code
    UNIQUE ("processDefinitionId", "taskDefinitionKey", code)
);
