
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE estado_solicitud_compra AS ENUM (
  'BORRADOR',
  'SOLICITADO',
  'EN_REVISION',
  'OBSERVADO',
  'APROBADO',
  'RECHAZADO'
);

CREATE TABLE solicitudes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(50) NOT NULL UNIQUE,
  concepto VARCHAR(200) NOT NULL,
  descripcion TEXT,
  monto NUMERIC(15, 2) NOT NULL
    CHECK (monto > 0),
  "solicitanteId" UUID NOT NULL,
  estado estado_solicitud_compra
    NOT NULL DEFAULT 'BORRADOR',
  "processInstanceId" VARCHAR(100) UNIQUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
