
ALTER TABLE workflow_actions
ADD COLUMN IF NOT EXISTS "businessStatus"
VARCHAR(100);

CREATE TABLE workflow_action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  "taskId" VARCHAR(150) NOT NULL UNIQUE,
  "actionId" UUID NOT NULL
    REFERENCES workflow_actions(id),

  "processInstanceId" VARCHAR(150) NOT NULL,
  "executedBy" VARCHAR(150) NOT NULL,

  status VARCHAR(40) NOT NULL DEFAULT 'PENDING'
    CHECK (
      status IN (
        'PENDING',
        'ENGINE_COMPLETED',
        'SYNCED',
        'RECONCILIATION_REQUIRED'
      )
    ),

  "businessStatus" VARCHAR(100),
  "errorMessage" TEXT,

  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_workflow_execution_status
ON workflow_action_executions(status);

CREATE INDEX ix_workflow_execution_process
ON workflow_action_executions("processInstanceId");
