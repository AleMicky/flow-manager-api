import {
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
    await this.flowable.getDefinitionById(dto.processDefinitionId);

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
          'Ya existe un formulario para esta tarea y versión',
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

  async findByTask(taskId: string) {
    const task = await this.flowable.getTaskById<FlowableTask>(taskId);

    if (!task.processDefinitionId || !task.taskDefinitionKey) {
      throw new NotFoundException(
        'La tarea no tiene una definición BPMN asociada',
      );
    }

    const form = await this.repository.findOneBy({
      processDefinitionId: task.processDefinitionId,
      taskDefinitionKey: task.taskDefinitionKey,
      active: true,
    });

    if (!form) {
      throw new NotFoundException(
        'No existe un formulario configurado para esta tarea',
      );
    }

    return form;
  }
}
