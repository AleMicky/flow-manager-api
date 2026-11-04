import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
export class FormsService {
  constructor(
    @InjectRepository(WorkflowForm)
    private readonly repository: Repository<WorkflowForm>,
    private readonly flowable: FlowableService,
  ) {}

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
