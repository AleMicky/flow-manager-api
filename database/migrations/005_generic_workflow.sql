
BEGIN;

CREATE TABLE IF NOT EXISTS workflow_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(150) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    "processDefinitionKey" VARCHAR(150) NOT NULL,
    "startFormSchema" JSONB NOT NULL DEFAULT
        '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "processId" UUID NOT NULL
        REFERENCES workflow_processes(id),
    title VARCHAR(250) NOT NULL,
    "processInstanceId" VARCHAR(150) UNIQUE,
    "processDefinitionId" VARCHAR(200),
    "startedBy" VARCHAR(150) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_START',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_submission_status CHECK (
        status IN (
            'PENDING_START',
            'START_FAILED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED'
        )
    )
);

CREATE INDEX IF NOT EXISTS ix_workflow_submissions_process
ON workflow_submissions("processId");

CREATE INDEX IF NOT EXISTS ix_workflow_submissions_started_by
ON workflow_submissions("startedBy");

CREATE INDEX IF NOT EXISTS ix_workflow_submissions_status
ON workflow_submissions(status);

COMMIT;
