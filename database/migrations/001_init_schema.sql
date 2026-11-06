-- =============================================================================
-- MIGRACIÓN CENTRALIZADA: FLOW MANAGER API (PR-GAF-08 ENDE ANDINA S.A.M.)
-- Crea todas las tablas necesarias, índices, restricciones y datos semilla.
-- =============================================================================

BEGIN;

-- 1. Extensión para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Eliminar objetos obsoletos si existieran de versiones previas
DROP TABLE IF EXISTS solicitudes_compra CASCADE;
DROP TYPE IF EXISTS estado_solicitud_compra CASCADE;

-- =============================================================================
-- 3. TABLA: workflow_processes (Catálogo de procesos de negocio)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(150) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  "processDefinitionKey" VARCHAR(150) NOT NULL,
  "codePrefix" VARCHAR(50) NOT NULL DEFAULT 'ADQ',
  "correlativeFormat" VARCHAR(100) NOT NULL DEFAULT '{prefix}-{number:3}/{year}',
  "startFormSchema" JSONB NOT NULL DEFAULT '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. TABLA: workflow_correlatives (Secuencias correlativas por proceso y año)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_correlatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "processDefinitionKey" VARCHAR(150) NOT NULL,
  year INT NOT NULL,
  "currentValue" INT NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workflow_correlatives_key_year UNIQUE ("processDefinitionKey", year)
);

-- =============================================================================
-- 5. TABLA: workflow_submissions (Expedientes / trámites iniciados)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "processId" UUID NOT NULL REFERENCES workflow_processes(id),
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

-- =============================================================================
-- 6. TABLA: workflow_forms (Formularios dinámicos JSON Schema por tarea BPMN)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "processDefinitionKey" VARCHAR(150),
  "processDefinitionId" VARCHAR(150),
  "taskDefinitionKey" VARCHAR(150) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  schema JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workflow_forms_key_task
    UNIQUE ("processDefinitionKey", "taskDefinitionKey")
);

-- =============================================================================
-- 7. TABLA: workflow_task_assignments (Asignación de tareas a grupos/usuarios)
-- =============================================================================
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

-- =============================================================================
-- 8. TABLAS: workflow_actions y workflow_action_executions (Acciones de tarea)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "processDefinitionId" VARCHAR(150) NOT NULL,
  "taskDefinitionKey" VARCHAR(150) NOT NULL,
  code VARCHAR(100) NOT NULL,
  label VARCHAR(150) NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "businessStatus" VARCHAR(100),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workflow_action_definition_task_code
    UNIQUE ("processDefinitionId", "taskDefinitionKey", code)
);

CREATE TABLE IF NOT EXISTS workflow_action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "taskId" VARCHAR(150) NOT NULL UNIQUE,
  "actionId" UUID NOT NULL REFERENCES workflow_actions(id),
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

CREATE INDEX IF NOT EXISTS ix_workflow_execution_status
  ON workflow_action_executions(status);

CREATE INDEX IF NOT EXISTS ix_workflow_execution_process
  ON workflow_action_executions("processInstanceId");

-- =============================================================================
-- 9. DATOS SEMILLA: Proceso PR-GAF-08 (ENDE ANDINA S.A.M.)
-- =============================================================================
INSERT INTO workflow_processes (
  id,
  key,
  name,
  description,
  "processDefinitionKey",
  "codePrefix",
  "correlativeFormat",
  "startFormSchema",
  active
) VALUES (
  '11111111-2222-3333-4444-555555555555',
  'pr-gaf-08-adquisiciones',
  'PR-GAF-08 Flujo de Aprobaciones de Adquisiciones',
  'ENDE ANDINA S.A.M. - Estados, responsables y notificaciones por categoría de materialidad.',
  'prGaf08Adquisiciones',
  'ADQ',
  '{prefix}-{number:3}/{year}',
  '{
    "type": "object",
    "required": ["objetoContratacion", "categoria", "montoEstimadoBs", "tipoAdquisicion", "adjuntoET_TDR", "adjuntoCotizacion"],
    "properties": {
      "objetoContratacion": {
        "type": "string",
        "title": "Objeto de la Contratación / Descripción",
        "description": "Detalle claro de los bienes o servicios requeridos"
      },
      "categoria": {
        "type": "string",
        "title": "Categoría por Nivel de Materialidad",
        "enum": ["CATEGORIA_I", "CATEGORIA_II", "CATEGORIA_III", "CATEGORIA_ESPECIAL"],
        "enumNames": [
          "Categoría I (Hasta Bs. 150.000)",
          "Categoría II (Bs. 150.001 hasta Bs. 14.000.000)",
          "Categoría III (Mayor a Bs. 14.000.000)",
          "Categoría Especial (Sin límite de monto - Excepcional)"
        ],
        "default": "CATEGORIA_I"
      },
      "montoEstimadoBs": {
        "type": "number",
        "title": "Monto Estimado Referencial (Bs.)",
        "minimum": 0.01
      },
      "tipoAdquisicion": {
        "type": "string",
        "title": "Tipo de Adquisición",
        "enum": ["BIEN", "SERVICIO"],
        "enumNames": ["Bien / Material / Activo", "Servicio / Consultoría"]
      },
      "adjuntoET_TDR": {
        "type": "string",
        "title": "Especificaciones Técnicas (ET) o Términos de Referencia (TDR)",
        "description": "Nombre de archivo o enlace al documento"
      },
      "adjuntoCotizacion": {
        "type": "string",
        "title": "Cotizaciones Adjuntas",
        "description": "Nombre de archivo o enlace al documento"
      }
    }
  }'::jsonb,
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  "codePrefix" = EXCLUDED."codePrefix",
  "correlativeFormat" = EXCLUDED."correlativeFormat",
  "startFormSchema" = EXCLUDED."startFormSchema",
  active = EXCLUDED.active;

-- =============================================================================
-- 10. DATOS SEMILLA: Formularios Dinámicos por Tarea (PR-GAF-08)
-- =============================================================================

-- 10.1 Verificación de Existencias / Activos
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskVerificarExistencias',
  'Verificación de existencias / activos (Almacenes y Activos Fijos)',
  'Confirmar disponibilidad física y técnica de activos o materiales en inventario.',
  '{
    "type": "object",
    "required": ["hayExistencias", "aprobadoAlmacenes", "obsAlmacenes"],
    "properties": {
      "hayExistencias": {
        "type": "boolean",
        "title": "¿Existen activos o materiales disponibles en almacén que cubran la necesidad?"
      },
      "aprobadoAlmacenes": {
        "type": "boolean",
        "title": "VoBo / Autorización de Almacenes y Activos Fijos",
        "description": "Aprobar para proceder a contratación externa o Rechazar si no corresponde"
      },
      "obsAlmacenes": {
        "type": "string",
        "title": "Informe Técnico / Observaciones de Almacenes",
        "format": "textarea"
      },
      "informeAlmacen": {
        "type": "string",
        "title": "Certificado de No Existencias (PDF)",
        "format": "binary"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.2 Verificación de Presupuesto
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskVerificarPresupuesto',
  'Verificación de Presupuesto',
  'Confirmar disponibilidad presupuestaria y partida contable correspondiente.',
  '{
    "type": "object",
    "required": ["partidaPresupuestaria", "montoEstimadoBs", "aprobadoPresupuesto", "obsPresupuesto"],
    "properties": {
      "partidaPresupuestaria": {
        "type": "string",
        "title": "Número / Código de Partida Presupuestaria"
      },
      "montoEstimadoBs": {
        "type": "number",
        "title": "Monto Estimado Certificado (Bs.)",
        "minimum": 0.01
      },
      "preventivo": {
        "type": "string",
        "title": "Nº de Certificación Preventiva"
      },
      "aprobadoPresupuesto": {
        "type": "boolean",
        "title": "¿Cuenta con saldo y certificación presupuestaria suficiente?"
      },
      "obsPresupuesto": {
        "type": "string",
        "title": "Observaciones / Certificación Presupuestaria",
        "format": "textarea"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.3 Subsanación y Ajuste de Solicitud (Unidad Solicitante)
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskAjustarSolicitud',
  'Subsanación y Ajuste de Solicitud (Unidad Solicitante)',
  'Ajuste, corrección documental o desistimiento por parte del solicitante tras observaciones.',
  '{
    "type": "object",
    "required": ["accionSolicitante", "justificacionAjuste"],
    "properties": {
      "accionSolicitante": {
        "type": "string",
        "title": "Acción a Tomar",
        "enum": ["REENVIAR", "CANCELAR"],
        "enumNames": [
          "Reenviar solicitud con ajustes / subsanaciones",
          "Desistir y cancelar proceso de adquisición"
        ],
        "default": "REENVIAR"
      },
      "justificacionAjuste": {
        "type": "string",
        "title": "Detalle de modificaciones o subsanaciones realizadas",
        "format": "textarea"
      },
      "documentoAjustado": {
        "type": "string",
        "title": "ET, TDR o Cotización Subsanada (PDF)",
        "format": "binary"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.4 Asignación de Encargado de Contratación
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskAsignarEncargado',
  'Asignación Encargado de Adquisiciones',
  'Asignar al profesional responsable de conducir el proceso de contratación.',
  '{
    "type": "object",
    "required": ["encargadoContratacionUserId"],
    "properties": {
      "encargadoContratacionUserId": {
        "type": "string",
        "title": "ID de Usuario del Encargado de Contratación (Keycloak)"
      },
      "instruccionesAsignacion": {
        "type": "string",
        "title": "Instrucciones de la Jefatura de Adquisiciones",
        "format": "textarea"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.5 Revisión Solicitud de Adquisición
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskRevisarSolicitud',
  'Revisión Solicitud de Adquisición',
  'Verificación documental, anexos y remisión al Jefe Inmediato Superior.',
  '{
    "type": "object",
    "required": ["documentosCompletos", "tipoAdquisicionDefinitivo", "observacionesRevision"],
    "properties": {
      "tipoAdquisicionDefinitivo": {
        "type": "string",
        "title": "Confirmación de Tipo",
        "enum": ["BIEN", "SERVICIO", "CONSULTORIA"],
        "enumNames": [
          "Bien / Material / Activo",
          "Servicio General",
          "Consultoría Especializada"
        ]
      },
      "documentosCompletos": {
        "type": "boolean",
        "title": "¿PDFs firmados, ET/TDR, cotizaciones y anexos completos?"
      },
      "observacionesRevision": {
        "type": "string",
        "title": "Informe de Revisión Documental",
        "format": "textarea"
      },
      "documentosPdfFirmados": {
        "type": "string",
        "title": "Expediente Documental Revisado (PDF)",
        "format": "binary"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.6 Aprobación Inmediato Superior
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskAprobacionSuperior',
  'Aprobación Inmediato Superior - Unidad Solicitante',
  'Visto Bueno y autorización de la jefatura directa de la unidad solicitante.',
  '{
    "type": "object",
    "required": ["aprobadoSuperior", "obsSuperior"],
    "properties": {
      "aprobadoSuperior": {
        "type": "boolean",
        "title": "¿Aprueba la solicitud de adquisición para su trámite?"
      },
      "obsSuperior": {
        "type": "string",
        "title": "Comentarios / Fundamento de Aprobación o Rechazo",
        "format": "textarea"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.7 Aprobación GAF (Categoría I)
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskGafCat1',
  'Aprobación Gerencia Administrativa Financiera (Cat. I)',
  'Revisión y autorización para trámite por Gerente de Área.',
  '{
    "type": "object",
    "required": ["aprobadoGaf", "obsGaf"],
    "properties": {
      "aprobadoGaf": {
        "type": "boolean",
        "title": "VoBo Gerencia Administrativa Financiera"
      },
      "obsGaf": {
        "type": "string",
        "title": "Observaciones GAF",
        "format": "textarea"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.8 Decisión Final (Cat. I - Gerente de Área)
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskDecisionFinalCat1',
  'Decisión Final - Gerente de Área (Cat. I)',
  'Resolución definitiva del proceso de contratación hasta Bs. 150.000.',
  '{
    "type": "object",
    "required": ["decisionFinal", "justificacion"],
    "properties": {
      "decisionFinal": {
        "type": "string",
        "title": "Decisión Final del Responsable de Contratación",
        "enum": ["APROBADO", "OBSERVADO", "RECHAZADO"],
        "enumNames": [
          "Aprobado (Autoriza inicio del proceso de contratación)",
          "Observado (Retorna para subsanación documental)",
          "Rechazado (Cancela y archiva el proceso)"
        ]
      },
      "justificacion": {
        "type": "string",
        "title": "Fundamentación y Justificación de la Decisión",
        "format": "textarea",
        "minLength": 5
      },
      "actaAprobacion": {
        "type": "string",
        "title": "Resolución de Adjudicación / Autorización Firmada (PDF)",
        "format": "binary"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.9 VoBo Financiero (Cat. II / III - Jefe Administrativo Financiero)
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskVoboFinanciero',
  'Visto Bueno Financiero (Jefe Administrativo Financiero)',
  'Validación financiera del proceso para contrataciones mayores a Bs. 150.000.',
  '{
    "type": "object",
    "required": ["aprobadoFinanciero", "obsFinanciero"],
    "properties": {
      "aprobadoFinanciero": {
        "type": "boolean",
        "title": "¿Otorga el VoBo Administrativo Financiero para la contratación?"
      },
      "obsFinanciero": {
        "type": "string",
        "title": "Informe / Detalle y Dictamen Financiero",
        "format": "textarea"
      },
      "informeFinanciero": {
        "type": "string",
        "title": "Informe Financiero Adjunto (PDF)",
        "format": "binary"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.10 VoBo Legal (Cat. II / III - Jefe Legal)
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskVoboLegal',
  'Visto Bueno Legal (Jefe Legal)',
  'Validación y dictamen legal para contrataciones mayores a Bs. 150.000.',
  '{
    "type": "object",
    "required": ["aprobadoLegal", "obsLegal"],
    "properties": {
      "aprobadoLegal": {
        "type": "boolean",
        "title": "¿Otorga el VoBo Legal conforme para la contratación?"
      },
      "obsLegal": {
        "type": "string",
        "title": "Dictamen / Informe Legal de Procedencia",
        "format": "textarea"
      },
      "informeLegal": {
        "type": "string",
        "title": "Dictamen Jurídico Firmado (PDF)",
        "format": "binary"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.11 Aprobación GAF y Designación de Comités (Cat. II / III)
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskGafCat2',
  'Aprobación y Designación de Comités (GAF)',
  'Designación oficial del Comité Evaluador y del Responsable de Recepción.',
  '{
    "type": "object",
    "required": ["aprobadoGaf", "comiteEvaluador", "responsableRecepcion"],
    "properties": {
      "aprobadoGaf": {
        "type": "boolean",
        "title": "VoBo Gerencia Administrativa Financiera"
      },
      "comiteEvaluador": {
        "type": "string",
        "title": "Miembros del Comité Evaluador Designados (Solicitante + Adm./Fin.)",
        "description": "Nombres y cargos de los miembros designados"
      },
      "responsableRecepcion": {
        "type": "string",
        "title": "Responsable de Recepción Designado",
        "description": "Nombre y cargo del responsable"
      },
      "memorandoDesignacion": {
        "type": "string",
        "title": "Memorando de Designación Oficial Firmado (PDF)",
        "format": "binary"
      },
      "obsGaf": {
        "type": "string",
        "title": "Observaciones / Instrucciones de GAF",
        "format": "textarea"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.12 Decisión Final (Cat. II / III / Especial - Gerente General)
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskDecisionFinalCat2',
  'Decisión Final - Gerente General (Cat. II, III y Especial)',
  'Resolución definitiva del Responsable de Contratación para procesos mayores a Bs. 150.000.',
  '{
    "type": "object",
    "required": ["decisionFinal", "justificacion"],
    "properties": {
      "decisionFinal": {
        "type": "string",
        "title": "Decisión Final del Gerente General",
        "enum": ["APROBADO", "OBSERVADO", "RECHAZADO"],
        "enumNames": [
          "Aprobado (Autoriza inicio del proceso de contratación y notifica comités)",
          "Observado (Retorna para subsanación/ajuste)",
          "Rechazado (Cancela y archiva el proceso)"
        ]
      },
      "justificacion": {
        "type": "string",
        "title": "Fundamentación y Justificación de la Decisión",
        "format": "textarea",
        "minLength": 5
      },
      "resolucionFirmada": {
        "type": "string",
        "title": "Resolución de Gerencia General Firmada (PDF)",
        "format": "binary"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 10.13 Informes de Cierre y Cancelación (cuando es Rechazado)
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskInformesCierre',
  'Adjuntar Informes Técnico y Legal de Cancelación y Archivo',
  'Subir informes motivados requeridos por normativa antes del cierre y archivo definitivo.',
  '{
    "type": "object",
    "required": ["adjuntoInformeTecnico", "adjuntoInformeLegal", "conclusionesCierre"],
    "properties": {
      "adjuntoInformeTecnico": {
        "type": "string",
        "title": "Informe Técnico de Justificación de Rechazo / Cancelación (PDF)",
        "format": "binary"
      },
      "adjuntoInformeLegal": {
        "type": "string",
        "title": "Informe Legal de Soporte para Archivo (PDF)",
        "format": "binary"
      },
      "conclusionesCierre": {
        "type": "string",
        "title": "Conclusiones y Constancia de Archivo Definitivo",
        "format": "textarea"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- =============================================================================
-- 11. DATOS SEMILLA: Asignación de Tareas a Grupos de Keycloak (PR-GAF-08)
-- =============================================================================
INSERT INTO workflow_task_assignments ("processDefinitionKey", "taskDefinitionKey", "taskName", "candidateGroups", "candidateUsers", active)
VALUES
  ('prGaf08Adquisiciones', 'taskVerificarExistencias', 'Verificación de existencias / activos', '["encargado-almacenes"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskVerificarPresupuesto', 'Verificación de presupuesto', '["encargado-presupuestos"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskAjustarSolicitud', 'Subsanación / Ajuste de Solicitud', '["unidad-solicitante"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskAsignarEncargado', 'Asignación Encargado de Adquisiciones', '["jefe-adquisiciones"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskRevisarSolicitud', 'Revisión solicitud de adquisición', '[]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskAprobacionSuperior', 'Aprobación Inmediato Superior', '["jefe-inmediato-superior"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskGafCat1', 'Aprobación GAF (Cat I)', '["gerencia-administrativa-financiera"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskDecisionFinalCat1', 'Decisión final (Gerente de Área)', '["gerente-area"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskVoboFinanciero', 'Visto bueno financiero', '["jefe-administrativo-financiero"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskVoboLegal', 'Visto bueno legal', '["jefe-legal"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskGafCat2', 'Aprobación y Designación Comités (GAF)', '["gerencia-administrativa-financiera"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskDecisionFinalCat2', 'Decisión final (Gerente General)', '["gerente-general"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskInformesCierre', 'Adjuntar Informes Técnico y Legal de Cancelación', '["adquisiciones", "jefe-adquisiciones"]'::jsonb, '[]'::jsonb, true)
ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  "taskName" = EXCLUDED."taskName",
  "candidateGroups" = EXCLUDED."candidateGroups",
  active = EXCLUDED.active;

COMMIT;

