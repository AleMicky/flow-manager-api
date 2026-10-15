import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { FlowableService } from '../infrastructure/flowable/flowable.service.js';
import { WorkflowAction } from './entities/workflow-action.entity.js';
import { CreateActionDto } from './dto/create-action.dto.js';

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(WorkflowAction)
    private readonly repository: Repository<WorkflowAction>,
    private readonly flowable: FlowableService,
  ) {}

  async create(dto: CreateActionDto) {
    // Verificar que la definición BPMN exista en Flowable.
    await this.flowable.getDefinitionById(dto.processDefinitionId);

    const action = this.repository.create(dto);

    try {
      return await this.repository.save(action);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
        throw new ConflictException(
          'La acción ya existe para esta tarea y versión',
        );
      }

      throw error;
    }
  }

  findByTask(processDefinitionId: string, taskDefinitionKey: string) {
    return this.repository.find({
      where: {
        processDefinitionId,
        taskDefinitionKey,
        active: true,
      },
      order: {
        sortOrder: 'ASC',
        code: 'ASC',
      },
    });
  }

  async findOne(id: string) {
    const action = await this.repository.findOneBy({
      id,
    });

    if (!action) {
      throw new NotFoundException('Acción no encontrada');
    }

    return action;
  }
}
