BEGIN;

-- 1. Asegurar extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Agregar columnas de configuración de correlativo a workflow_processes
ALTER TABLE workflow_processes
  ADD COLUMN IF NOT EXISTS "codePrefix" VARCHAR(50) DEFAULT 'ADQ',
  ADD COLUMN IF NOT EXISTS "correlativeFormat" VARCHAR(100) DEFAULT '{prefix}-{number:3}/{year}';

-- 3. Configurar PR-GAF-08 con prefijo ADQ y formato ADQ-001/2026
UPDATE workflow_processes
SET 
  "codePrefix" = 'ADQ',
  "correlativeFormat" = '{prefix}-{number:3}/{year}'
WHERE "processDefinitionKey" = 'prGaf08Adquisiciones' OR key = 'pr-gaf-08-adquisiciones';

-- 4. Crear tabla de secuencias correlativas por proceso y gestión (año)
CREATE TABLE IF NOT EXISTS workflow_correlatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "processDefinitionKey" VARCHAR(150) NOT NULL,
  year INT NOT NULL,
  "currentValue" INT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workflow_correlatives_key_year UNIQUE ("processDefinitionKey", year)
);

COMMIT;

