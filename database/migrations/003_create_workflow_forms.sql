
CREATE TABLE workflow_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  "processDefinitionId" VARCHAR(150) NOT NULL,
  "taskDefinitionKey" VARCHAR(150) NOT NULL,

  title VARCHAR(150) NOT NULL,
  description TEXT,

  schema JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,

  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_workflow_form_definition_task
    UNIQUE ("processDefinitionId", "taskDefinitionKey")
);
