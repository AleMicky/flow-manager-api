import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { FlowableService } from '../infrastructure/flowable/flowable.service.js';
import { WorkflowForm } from './entities/workflow-form.entity.js';
import { CreateFormDto } from './dto/create-form.dto.js';

interface FlowableTask {
  id: string;
  processDefinitionId: string | null;
  taskDefinitionKey: string | null;
}

@Injectable()
export class FormsService implements OnModuleInit {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    @InjectRepository(WorkflowForm)
    private readonly repository: Repository<WorkflowForm>,
    private readonly flowable: FlowableService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedPreconfiguredForms();
    } catch (error) {
      this.logger.warn(
        `No se pudieron auto-sembrar los formularios preconfigurados: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Preconfiguración de formularios dinámicos oficiales para PR-GAF-08
   * Permite que todas las etapas cuenten con su esquema sin requerir configuración manual previa.
   */
  private async seedPreconfiguredForms(): Promise<void> {
    const defaultForms: CreateFormDto[] = [
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskVerificarExistencias',
        title: 'Verificación de existencias / activos (Almacenes y Activos Fijos)',
        description:
          'Confirmar disponibilidad física y técnica de activos o materiales en inventario.',
        active: true,
        schema: {
          type: 'object',
          required: ['hayExistencias', 'aprobadoAlmacenes', 'obsAlmacenes'],
          properties: {
            hayExistencias: {
              type: 'boolean',
              title:
                '¿Existen activos o materiales disponibles en almacén que cubran la necesidad?',
            },
            aprobadoAlmacenes: {
              type: 'boolean',
              title: 'VoBo / Autorización de Almacenes y Activos Fijos',
              description:
                'Aprobar para proceder a contratación externa o Rechazar si no corresponde',
            },
            obsAlmacenes: {
              type: 'string',
              title: 'Informe Técnico / Observaciones de Almacenes',
              format: 'textarea',
            },
            informeAlmacen: {
              type: 'string',
              title: 'Certificado de No Existencias (PDF)',
              format: 'binary',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskVerificarPresupuesto',
        title: 'Verificación de Presupuesto',
        description:
          'Confirmar disponibilidad presupuestaria y partida contable correspondiente.',
        active: true,
        schema: {
          type: 'object',
          required: [
            'partidaPresupuestaria',
            'montoEstimadoBs',
            'aprobadoPresupuesto',
            'obsPresupuesto',
          ],
          properties: {
            partidaPresupuestaria: {
              type: 'string',
              title: 'Número / Código de Partida Presupuestaria',
            },
            montoEstimadoBs: {
              type: 'number',
              title: 'Monto Estimado Certificado (Bs.)',
              minimum: 0.01,
            },
            preventivo: {
              type: 'string',
              title: 'Nº de Certificación Preventiva',
            },
            aprobadoPresupuesto: {
              type: 'boolean',
              title: '¿Cuenta con saldo y certificación presupuestaria suficiente?',
            },
            obsPresupuesto: {
              type: 'string',
              title: 'Observaciones / Certificación Presupuestaria',
              format: 'textarea',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskAjustarSolicitud',
        title: 'Subsanación y Ajuste de Solicitud (Unidad Solicitante)',
        description:
          'Ajuste, corrección documental o desistimiento por parte del solicitante tras observaciones.',
        active: true,
        schema: {
          type: 'object',
          required: ['accionSolicitante', 'justificacionAjuste'],
          properties: {
            accionSolicitante: {
              type: 'string',
              title: 'Acción a Tomar',
              enum: ['REENVIAR', 'CANCELAR'],
              enumNames: [
                'Reenviar solicitud con ajustes / subsanaciones',
                'Desistir y cancelar proceso de adquisición',
              ],
              default: 'REENVIAR',
            },
            justificacionAjuste: {
              type: 'string',
              title: 'Detalle de modificaciones o subsanaciones realizadas',
              format: 'textarea',
            },
            documentoAjustado: {
              type: 'string',
              title: 'ET, TDR o Cotización Subsanada (PDF)',
              format: 'binary',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskAsignarEncargado',
        title: 'Asignación Encargado de Adquisiciones',
        description:
          'Asignar al profesional responsable de conducir el proceso de contratación.',
        active: true,
        schema: {
          type: 'object',
          required: ['encargadoContratacionUserId'],
          properties: {
            encargadoContratacionUserId: {
              type: 'string',
              title: 'ID de Usuario del Encargado de Contratación (Keycloak)',
            },
            instruccionesAsignacion: {
              type: 'string',
              title: 'Instrucciones de la Jefatura de Adquisiciones',
              format: 'textarea',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskRevisarSolicitud',
        title: 'Revisión Solicitud de Adquisición',
        description:
          'Verificación documental, anexos y remisión al Jefe Inmediato Superior.',
        active: true,
        schema: {
          type: 'object',
          required: [
            'documentosCompletos',
            'tipoAdquisicionDefinitivo',
            'observacionesRevision',
          ],
          properties: {
            tipoAdquisicionDefinitivo: {
              type: 'string',
              title: 'Confirmación de Tipo',
              enum: ['BIEN', 'SERVICIO', 'CONSULTORIA'],
              enumNames: [
                'Bien / Material / Activo',
                'Servicio General',
                'Consultoría Especializada',
              ],
            },
            documentosCompletos: {
              type: 'boolean',
              title: '¿PDFs firmados, ET/TDR, cotizaciones y anexos completos?',
            },
            observacionesRevision: {
              type: 'string',
              title: 'Informe de Revisión Documental',
              format: 'textarea',
            },
            documentosPdfFirmados: {
              type: 'string',
              title: 'Expediente Documental Revisado (PDF)',
              format: 'binary',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskAprobacionSuperior',
        title: 'Aprobación Inmediato Superior - Unidad Solicitante',
        description:
          'Visto Bueno y autorización de la jefatura directa de la unidad solicitante.',
        active: true,
        schema: {
          type: 'object',
          required: ['aprobadoSuperior', 'obsSuperior'],
          properties: {
            aprobadoSuperior: {
              type: 'boolean',
              title: '¿Aprueba la solicitud de adquisición para su trámite?',
            },
            obsSuperior: {
              type: 'string',
              title: 'Comentarios / Fundamento de Aprobación o Rechazo',
              format: 'textarea',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskGafCat1',
        title: 'Aprobación Gerencia Administrativa Financiera (Cat. I)',
        description: 'Revisión y autorización para trámite por Gerente de Área.',
        active: true,
        schema: {
          type: 'object',
          required: ['aprobadoGaf', 'obsGaf'],
          properties: {
            aprobadoGaf: {
              type: 'boolean',
              title: 'VoBo Gerencia Administrativa Financiera',
            },
            obsGaf: {
              type: 'string',
              title: 'Observaciones GAF',
              format: 'textarea',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskDecisionFinalCat1',
        title: 'Decisión Final - Gerente de Área (Cat. I)',
        description:
          'Resolución definitiva del proceso de contratación hasta Bs. 150.000.',
        active: true,
        schema: {
          type: 'object',
          required: ['decisionFinal', 'justificacion'],
          properties: {
            decisionFinal: {
              type: 'string',
              title: 'Decisión Final del Responsable de Contratación',
              enum: ['APROBADO', 'OBSERVADO', 'RECHAZADO'],
              enumNames: [
                'Aprobado (Autoriza inicio del proceso de contratación)',
                'Observado (Retorna para subsanación documental)',
                'Rechazado (Cancela y archiva el proceso)',
              ],
            },
            justificacion: {
              type: 'string',
              title: 'Fundamentación y Justificación de la Decisión',
              format: 'textarea',
              minLength: 5,
            },
            actaAprobacion: {
              type: 'string',
              title: 'Resolución de Adjudicación / Autorización Firmada (PDF)',
              format: 'binary',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskVoboFinanciero',
        title: 'Visto Bueno Financiero (Jefe Administrativo Financiero)',
        description:
          'Validación financiera del proceso para contrataciones mayores a Bs. 150.000.',
        active: true,
        schema: {
          type: 'object',
          required: ['voboFinanciero', 'obsFinanciero'],
          properties: {
            voboFinanciero: {
              type: 'boolean',
              title: 'VoBo Administrativo Financiero Otorgado',
            },
            obsFinanciero: {
              type: 'string',
              title: 'Informe / Detalle Financiero',
              format: 'textarea',
            },
            informeFinanciero: {
              type: 'string',
              title: 'Informe Financiero Adjunto (PDF)',
              format: 'binary',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskVoboLegal',
        title: 'Visto Bueno Legal (Jefe Legal)',
        description:
          'Validación y dictamen legal para contrataciones mayores a Bs. 150.000.',
        active: true,
        schema: {
          type: 'object',
          required: ['voboLegal', 'obsLegal'],
          properties: {
            voboLegal: {
              type: 'boolean',
              title: 'VoBo Legal Otorgado',
            },
            obsLegal: {
              type: 'string',
              title: 'Informe / Dictamen Legal',
              format: 'textarea',
            },
            informeLegal: {
              type: 'string',
              title: 'Dictamen Jurídico Firmado (PDF)',
              format: 'binary',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskGafCat2',
        title: 'Aprobación y Designación de Comités (GAF)',
        description:
          'Designación oficial del Comité Evaluador y del Responsable de Recepción.',
        active: true,
        schema: {
          type: 'object',
          required: ['aprobadoGaf', 'comiteEvaluador', 'responsableRecepcion'],
          properties: {
            aprobadoGaf: {
              type: 'boolean',
              title: 'VoBo Gerencia Administrativa Financiera',
            },
            comiteEvaluador: {
              type: 'string',
              title:
                'Miembros del Comité Evaluador Designados (Solicitante + Adm./Fin.)',
              description: 'Nombres y cargos de los miembros designados',
            },
            responsableRecepcion: {
              type: 'string',
              title: 'Responsable de Recepción Designado',
              description: 'Nombre y cargo del responsable',
            },
            memorandoDesignacion: {
              type: 'string',
              title: 'Memorando de Designación Oficial Firmado (PDF)',
              format: 'binary',
            },
            obsGaf: {
              type: 'string',
              title: 'Observaciones / Instrucciones de GAF',
              format: 'textarea',
            },
          },
        },
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskDecisionFinalCat2',
        title: 'Decisión Final - Gerente General (Cat. II, III y Especial)',
        description:
          'Resolución definitiva del Responsable de Contratación para procesos mayores a Bs. 150.000.',
        active: true,
        schema: {
          type: 'object',
          required: ['decisionFinal', 'justificacion'],
          properties: {
            decisionFinal: {
              type: 'string',
              title: 'Decisión Final del Gerente General',
              enum: ['APROBADO', 'OBSERVADO', 'RECHAZADO'],
              enumNames: [
                'Aprobado (Autoriza inicio del proceso de contratación y notifica comités)',
                'Observado (Retorna para subsanación/ajuste)',
                'Rechazado (Cancela y archiva el proceso)',
              ],
            },
            justificacion: {
              type: 'string',
              title: 'Fundamentación y Justificación de la Decisión',
              format: 'textarea',
              minLength: 5,
            },
            resolucionFirmada: {
              type: 'string',
              title: 'Resolución de Gerencia General Firmada (PDF)',
              format: 'binary',
            },
          },
        },
      },
    ];

    for (const formDto of defaultForms) {
      const existing = await this.repository.findOne({
        where: {
          processDefinitionKey: formDto.processDefinitionKey,
          taskDefinitionKey: formDto.taskDefinitionKey,
        },
      });

      if (!existing) {
        const form = this.repository.create({
          ...formDto,
          description: formDto.description ?? null,
        });
        await this.repository.save(form);
        this.logger.log(
          `Formulario preconfigurado registrado: [${formDto.processDefinitionKey}] -> ${formDto.taskDefinitionKey}`,
        );
      }
    }
  }

  async create(dto: CreateFormDto) {
    if (!dto.processDefinitionKey && !dto.processDefinitionId) {
      throw new BadRequestException(
        'Debe especificar processDefinitionKey o processDefinitionId',
      );
    }

    if (dto.processDefinitionId) {
      await this.flowable.getDefinitionById(dto.processDefinitionId);
    }

    const form = this.repository.create({
      ...dto,
      description: dto.description ?? null,
    });

    try {
      return await this.repository.save(form);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'Ya existe un formulario para esta tarea y proceso',
        );
      }

      throw error;
    }
  }

  async findOne(id: string) {
    const form = await this.repository.findOneBy({ id });

    if (!form) {
      throw new NotFoundException('Formulario no encontrado');
    }

    return form;
  }

  async findByProcess(processDefinitionKey: string): Promise<WorkflowForm[]> {
    return this.repository.find({
      where: { processDefinitionKey },
      order: { taskDefinitionKey: 'ASC' },
    });
  }

  async findByProcessAndTask(
    processDefinitionKey: string,
    taskDefinitionKey: string,
  ): Promise<WorkflowForm | null> {
    return this.repository.findOne({
      where: { processDefinitionKey, taskDefinitionKey },
    });
  }

  async upsert(dto: CreateFormDto): Promise<WorkflowForm> {
    const processKey = dto.processDefinitionKey;
    const taskKey = dto.taskDefinitionKey;

    let existing: WorkflowForm | null = null;
    if (processKey && taskKey) {
      existing = await this.repository.findOne({
        where: { processDefinitionKey: processKey, taskDefinitionKey: taskKey },
      });
    }

    if (existing) {
      existing.title = dto.title;
      existing.description = dto.description ?? null;
      existing.schema = dto.schema;
      if (dto.active !== undefined) {
        existing.active = dto.active;
      }
      if (dto.processDefinitionId) {
        existing.processDefinitionId = dto.processDefinitionId;
      }
      return this.repository.save(existing);
    }

    return this.create(dto);
  }

  async findOptionalByTask(taskId: string): Promise<WorkflowForm | null> {
    try {
      const task = await this.flowable.getTaskById<FlowableTask>(taskId);

      if (!task.taskDefinitionKey) {
        return null;
      }

      const processDefinitionKey = task.processDefinitionId
        ? task.processDefinitionId.split(':')[0]
        : null;

      const whereConditions: Array<Record<string, unknown>> = [
        {
          taskDefinitionKey: task.taskDefinitionKey,
          active: true,
        },
      ];

      if (task.processDefinitionId) {
        whereConditions.unshift({
          processDefinitionId: task.processDefinitionId,
          taskDefinitionKey: task.taskDefinitionKey,
          active: true,
        });
      }

      if (processDefinitionKey) {
        whereConditions.unshift({
          processDefinitionKey,
          taskDefinitionKey: task.taskDefinitionKey,
          active: true,
        });
      }

      const form = await this.repository.findOne({
        where: whereConditions,
      });

      return form;
    } catch {
      return null;
    }
  }

  async findByTask(taskId: string) {
    const form = await this.findOptionalByTask(taskId);

    if (!form) {
      throw new NotFoundException(
        'No existe un formulario configurado para esta tarea',
      );
    }

    return form;
  }
}
