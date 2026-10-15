import { Injectable } from '@nestjs/common';

import { FlowableService } from '../infrastructure/flowable/flowable.service.js';

import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { ClaimTaskDto } from './dto/claim-task.dto.js';
import { CompleteTaskDto } from './dto/complete-task.dto.js';

import type {
  FlowablePage,
  WorkflowTask,
} from './interfaces/task.interface.js';

@Injectable()
export class TasksService {
  constructor(private readonly flowableService: FlowableService) {}

  findAll(query: QueryTasksDto) {
    const params: Record<string, unknown> = {
      start: query.start,
      size: query.size,
    };

    if (query.assignee) {
      params.assignee = query.assignee;
    }

    if (query.candidateGroup) {
      params.candidateGroup = query.candidateGroup;
    }

    if (query.processInstanceId) {
      params.processInstanceId = query.processInstanceId;
    }

    if (query.name) {
      params.name = query.name;
    }

    if (query.unassigned !== undefined) {
      params.unassigned = query.unassigned;
    }

    return this.flowableService.getTasks<FlowablePage<WorkflowTask>>(params);
  }

  findOne(id: string) {
    return this.flowableService.getTaskById<WorkflowTask>(id);
  }

  claim(id: string, dto: ClaimTaskDto) {
    return this.flowableService.claimTask<void>(id, dto.assignee);
  }

  unclaim(id: string) {
    return this.flowableService.unclaimTask<void>(id);
  }

  complete(id: string, dto: CompleteTaskDto) {
    return this.flowableService.completeTask<void>(id, dto.variables ?? {});
  }
}
