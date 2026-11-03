-- 1. Destrabar cualquier transacción previa que haya fallado
ROLLBACK;

BEGIN;

-- 2. Asegurar extensión UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 3. Crear workflow_forms con su restricción UNIQUE estándar
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
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE workflow_forms 
  ADD COLUMN IF NOT EXISTS "processDefinitionKey" VARCHAR(150),
  ALTER COLUMN "processDefinitionId" DROP NOT NULL;

-- Limpiar índice parcial previo y fijar restricción UNIQUE formal
DROP INDEX IF EXISTS uq_workflow_form_process_key_task;
ALTER TABLE workflow_forms DROP CONSTRAINT IF EXISTS uq_workflow_forms_key_task;
ALTER TABLE workflow_forms ADD CONSTRAINT uq_workflow_forms_key_task UNIQUE ("processDefinitionKey", "taskDefinitionKey");

-- 4. Asegurar workflow_processes
CREATE TABLE IF NOT EXISTS workflow_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(150) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  "processDefinitionKey" VARCHAR(150) NOT NULL,
  "startFormSchema" JSONB NOT NULL DEFAULT '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Asegurar workflow_task_assignments
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

-- 6. Insertar proceso PR-GAF-08
INSERT INTO workflow_processes (
  id,
  key,
  name,
  description,
  "processDefinitionKey",
  "startFormSchema",
  active
) VALUES (
  '11111111-2222-3333-4444-555555555555',
  'pr-gaf-08-adquisiciones',
  'PR-GAF-08 Flujo de Aprobaciones de Adquisiciones',
  'ENDE ANDINA S.A.M. - Estados, responsables y notificaciones por categoría de materialidad.',
  'prGaf08Adquisiciones',
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
  "startFormSchema" = EXCLUDED."startFormSchema",
  active = EXCLUDED.active;

-- 7. Insertar formularios dinámicos por tarea
-- 7.1 Verificación de Existencias / Activos
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
        "title": "Informe Técnico / Observaciones de Almacenes"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 7.2 Verificación de Presupuesto
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskVerificarPresupuesto',
  'Verificación de Presupuesto',
  'Confirmar disponibilidad presupuestaria y partida contable correspondiente.',
  '{
    "type": "object",
    "required": ["partidaPresupuestaria", "aprobadoPresupuesto", "obsPresupuesto"],
    "properties": {
      "partidaPresupuestaria": {
        "type": "string",
        "title": "Número / Código de Partida Presupuestaria"
      },
      "aprobadoPresupuesto": {
        "type": "boolean",
        "title": "¿Cuenta con saldo y certificación presupuestaria suficiente?"
      },
      "obsPresupuesto": {
        "type": "string",
        "title": "Observaciones / Certificación Presupuestaria"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 7.3 Asignación de Encargado de Contratación
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
        "title": "Instrucciones de la Jefatura de Adquisiciones"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 7.4 Revisión Solicitud de Adquisición
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
        "enum": ["BIEN", "SERVICIO"]
      },
      "documentosCompletos": {
        "type": "boolean",
        "title": "¿PDFs firmados, ET/TDR, cotizaciones y anexos completos?"
      },
      "observacionesRevision": {
        "type": "string",
        "title": "Informe de Revisión Documental"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 7.5 Aprobación Inmediato Superior
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
        "title": "Comentarios / Fundamento de Aprobación o Rechazo"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 7.6 Aprobación GAF (Categoría I)
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
        "title": "Observaciones GAF"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 7.7 Decisión Final (Cat. I - Gerente de Área)
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
        "minLength": 5
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 7.8 VoBo Financiero (Cat. II / III - Jefe Administrativo Financiero)
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskVoboFinanciero',
  'Visto Bueno Financiero (Jefe Administrativo Financiero)',
  'Validación financiera del proceso para contrataciones mayores a Bs. 150.000.',
  '{
    "type": "object",
    "required": ["voboFinanciero", "obsFinanciero"],
    "properties": {
      "voboFinanciero": {
        "type": "boolean",
        "title": "VoBo Administrativo Financiero Otorgado"
      },
      "obsFinanciero": {
        "type": "string",
        "title": "Informe / Detalle Financiero"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 7.9 VoBo Legal (Cat. II / III - Jefe Legal)
INSERT INTO workflow_forms ("processDefinitionKey", "taskDefinitionKey", title, description, schema, active)
VALUES (
  'prGaf08Adquisiciones',
  'taskVoboLegal',
  'Visto Bueno Legal (Jefe Legal)',
  'Validación y dictamen legal para contrataciones mayores a Bs. 150.000.',
  '{
    "type": "object",
    "required": ["voboLegal", "obsLegal"],
    "properties": {
      "voboLegal": {
        "type": "boolean",
        "title": "VoBo Legal Otorgado"
      },
      "obsLegal": {
        "type": "string",
        "title": "Informe / Dictamen Legal"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 7.10 Aprobación GAF y Designación de Comités (Cat. II / III)
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
      "obsGaf": {
        "type": "string",
        "title": "Observaciones / Instrucciones de GAF"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 7.11 Decisión Final (Cat. II / III / Especial - Gerente General)
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
        "minLength": 5
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  schema = EXCLUDED.schema;

-- 8. Asignación de Tareas a Grupos de Keycloak
INSERT INTO workflow_task_assignments ("processDefinitionKey", "taskDefinitionKey", "taskName", "candidateGroups", "candidateUsers", active)
VALUES
  ('prGaf08Adquisiciones', 'taskVerificarExistencias', 'Verificación de existencias / activos', '["encargado-almacenes"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskVerificarPresupuesto', 'Verificación de presupuesto', '["encargado-presupuestos"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskAsignarEncargado', 'Asignación Encargado de Adquisiciones', '["jefe-adquisiciones"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskRevisarSolicitud', 'Revisión solicitud de adquisición', '[]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskAprobacionSuperior', 'Aprobación Inmediato Superior', '["jefe-inmediato-superior"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskGafCat1', 'Aprobación GAF (Cat I)', '["gerencia-administrativa-financiera"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskDecisionFinalCat1', 'Decisión final (Gerente de Área)', '["gerente-area"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskVoboFinanciero', 'Visto bueno financiero', '["jefe-administrativo-financiero"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskVoboLegal', 'Visto bueno legal', '["jefe-legal"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskGafCat2', 'Aprobación y Designación Comités (GAF)', '["gerencia-administrativa-financiera"]'::jsonb, '[]'::jsonb, true),
  ('prGaf08Adquisiciones', 'taskDecisionFinalCat2', 'Decisión final (Gerente General)', '["gerente-general"]'::jsonb, '[]'::jsonb, true)
ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  "taskName" = EXCLUDED."taskName",
  "candidateGroups" = EXCLUDED."candidateGroups",
  active = EXCLUDED.active;

-- 9. Confirmar transacción
COMMIT;