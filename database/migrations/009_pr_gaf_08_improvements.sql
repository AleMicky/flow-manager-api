-- Migración 009: Mejoras al flujo PR-GAF-08 según normativa ENDE ANDINA S.A.M.
BEGIN;

-- 1. Actualizar formulario VoBo Financiero con variable aprobadoFinanciero
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
        "title": "Informe / Detalle y Dictamen Financiero"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 2. Actualizar formulario VoBo Legal con variable aprobadoLegal
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
        "title": "Dictamen / Informe Legal de Procedencia"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 3. Formulario para Informes de Cierre y Cancelación (PR-GAF-08 cuando Rechazado)
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
        "title": "Informe Técnico de Justificación de Rechazo / Cancelación (PDF)"
      },
      "adjuntoInformeLegal": {
        "type": "string",
        "title": "Informe Legal de Soporte para Archivo (PDF)"
      },
      "conclusionesCierre": {
        "type": "string",
        "title": "Conclusiones y Constancia de Archivo Definitivo"
      }
    }
  }'::jsonb,
  true
) ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  schema = EXCLUDED.schema;

-- 4. Asignación de tarea de informes de cierre
INSERT INTO workflow_task_assignments ("processDefinitionKey", "taskDefinitionKey", "taskName", "candidateGroups", "candidateUsers", active)
VALUES
  ('prGaf08Adquisiciones', 'taskInformesCierre', 'Adjuntar Informes Técnico y Legal de Cancelación', '["adquisiciones", "jefe-adquisiciones"]'::jsonb, '[]'::jsonb, true)
ON CONFLICT ("processDefinitionKey", "taskDefinitionKey") DO UPDATE SET
  "taskName" = EXCLUDED."taskName",
  "candidateGroups" = EXCLUDED."candidateGroups",
  active = EXCLUDED.active;

COMMIT;

