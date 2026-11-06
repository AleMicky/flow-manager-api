import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WorkflowProcess } from './entities/workflow-process.entity.js';
import { CreateProcessDto } from './dto/create-process.dto.js';

@Injectable()
export class ProcessesService implements OnModuleInit {
  private readonly logger = new Logger(ProcessesService.name);

  constructor(
    @InjectRepository(WorkflowProcess)
    private readonly repository: Repository<WorkflowProcess>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.repository.query(`
        CREATE EXTENSION IF NOT EXISTS pgcrypto;

        DROP TABLE IF EXISTS solicitudes_compra CASCADE;
        DROP TYPE IF EXISTS estado_solicitud_compra CASCADE;

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

        CREATE TABLE IF NOT EXISTS workflow_correlatives (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "processDefinitionKey" VARCHAR(150) NOT NULL,
          year INT NOT NULL,
          "currentValue" INT NOT NULL DEFAULT 0,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_workflow_correlatives_key_year UNIQUE ("processDefinitionKey", year)
        );

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
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

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
          status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
          "businessStatus" VARCHAR(100),
          "errorMessage" TEXT,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      const existing = await this.repository.findOneBy({
        key: 'pr-gaf-08-adquisiciones',
      });
      if (!existing) {
        await this.repository.save(
          this.repository.create({
            id: '11111111-2222-3333-4444-555555555555',
            key: 'pr-gaf-08-adquisiciones',
            name: 'PR-GAF-08 Flujo de Aprobaciones de Adquisiciones',
            description:
              'ENDE ANDINA S.A.M. - Estados, responsables y notificaciones por categoría de materialidad.',
            processDefinitionKey: 'prGaf08Adquisiciones',
            codePrefix: 'ADQ',
            correlativeFormat: '{prefix}-{number:3}/{year}',
            active: true,
            startFormSchema: {
              type: 'object',
              required: [
                'objetoContratacion',
                'categoria',
                'montoEstimadoBs',
                'tipoAdquisicion',
                'adjuntoET_TDR',
                'adjuntoCotizacion',
              ],
              properties: {
                objetoContratacion: {
                  type: 'string',
                  title: 'Objeto de la Contratación / Descripción',
                  description: 'Detalle claro de los bienes o servicios requeridos',
                },
                categoria: {
                  type: 'string',
                  title: 'Categoría por Nivel de Materialidad',
                  enum: [
                    'CATEGORIA_I',
                    'CATEGORIA_II',
                    'CATEGORIA_III',
                    'CATEGORIA_ESPECIAL',
                  ],
                  enumNames: [
                    'Categoría I (Hasta Bs. 150.000)',
                    'Categoría II (Bs. 150.001 hasta Bs. 14.000.000)',
                    'Categoría III (Mayor a Bs. 14.000.000)',
                    'Categoría Especial (Sin límite de monto - Excepcional)',
                  ],
                  default: 'CATEGORIA_I',
                },
                montoEstimadoBs: {
                  type: 'number',
                  title: 'Monto Estimado Referencial (Bs.)',
                  minimum: 0.01,
                },
                tipoAdquisicion: {
                  type: 'string',
                  title: 'Tipo de Adquisición',
                  enum: ['BIEN', 'SERVICIO'],
                  enumNames: [
                    'Bien / Material / Activo',
                    'Servicio / Consultoría',
                  ],
                },
                adjuntoET_TDR: {
                  type: 'string',
                  title:
                    'Especificaciones Técnicas (ET) o Términos de Referencia (TDR)',
                  description: 'Nombre de archivo o enlace al documento',
                },
                adjuntoCotizacion: {
                  type: 'string',
                  title: 'Cotizaciones Adjuntas',
                  description: 'Nombre de archivo o enlace al documento',
                },
              },
            },
          }),
        );
        this.logger.log(
          'Proceso preconfigurado registrado: [pr-gaf-08-adquisiciones]',
        );
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo inicializar esquema de procesos automáticamente: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async create(dto: CreateProcessDto) {
    const exists = await this.repository.existsBy({
      key: dto.key,
    });

    if (exists) {
      throw new ConflictException(
        'Ya existe un proceso con esta clave',
      );
    }

    const process = this.repository.create({
      ...dto,
      codePrefix: dto.codePrefix || 'ADQ',
      correlativeFormat: dto.correlativeFormat || '{prefix}-{number:3}/{year}',
      active: dto.active ?? false,
    });

    return this.repository.save(process);
  }

  findAll() {
    return this.repository.find({
      order: { name: 'ASC' },
    });
  }

  findActive() {
    return this.repository.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const process = await this.repository.findOneBy({ id });

    if (!process) {
      throw new NotFoundException(
        'Proceso no encontrado',
      );
    }

    return process;
  }

  async update(id: string, dto: Partial<CreateProcessDto>) {
    const process = await this.findOne(id);
    Object.assign(process, dto);
    return this.repository.save(process);
  }
}
