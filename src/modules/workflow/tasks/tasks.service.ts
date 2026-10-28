import { Injectable } from '@nestjs/common';

import { FlowableService } from '../infrastructure/flowable/flowable.service.js';
import { TaskAssignmentsService } from './services/task-assignments.service.js';

import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { ClaimTaskDto } from './dto/claim-task.dto.js';
import { CompleteTaskDto } from './dto/complete-task.dto.js';

import type {
  FlowablePage,
  WorkflowTask,
} from './interfaces/task.interface.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';

@Injectable()
export class TasksService {
  constructor(
    private readonly flowableService: FlowableService,
    private readonly taskAssignments: TaskAssignmentsService,
  ) {}

  findMine(user: AuthUser, query: QueryTasksDto) {
    const params: Record<string, unknown> = {
      start: query.start ?? 0,
      size: query.size ?? 20,
      assignee: user.id,
      ...(query.processInstanceId && {
        processInstanceId: query.processInstanceId,
      }),
      ...(query.name && { name: query.name }),
    };

    return this.flowableService.getTasks<FlowablePage<WorkflowTask>>(params);
  }

  async findAvailable(
    user: AuthUser,
    query: QueryTasksDto,
  ): Promise<FlowablePage<WorkflowTask>> {
    const start = query.start ?? 0;
    const size = query.size ?? 20;

    if (query.candidateGroup) {
      return this.flowableService.getTasks<FlowablePage<WorkflowTask>>({
        start,
        size,
        unassigned: true,
        candidateGroup: query.candidateGroup,
        ...(query.processInstanceId && {
          processInstanceId: query.processInstanceId,
        }),
        ...(query.name && { name: query.name }),
      });
    }

    const effectiveGroups =
      await this.taskAssignments.getUserEffectiveGroupsAndRoles(user);
    const matchingRules =
      await this.taskAssignments.findMatchingAssignmentsForUser(
        user,
        effectiveGroups,
      );

    const commonFilters: Record<string, unknown> = {
      unassigned: true,
      ...(query.processInstanceId && {
        processInstanceId: query.processInstanceId,
      }),
      ...(query.name && { name: query.name }),
    };

    const pagePromises: Array<Promise<FlowablePage<WorkflowTask>>> = [];

    if (effectiveGroups.length > 0) {
      pagePromises.push(
        this.flowableService.getTasks<FlowablePage<WorkflowTask>>({
          ...commonFilters,
          start: 0,
          size: 100,
          candidateGroupIn: effectiveGroups.join(','),
        }),
      );
    } else {
      pagePromises.push(
        this.flowableService.getTasks<FlowablePage<WorkflowTask>>({
          ...commonFilters,
          start: 0,
          size: 100,
          candidateUser: user.id,
        }),
      );
    }

    for (const rule of matchingRules) {
      pagePromises.push(
        this.flowableService.getTasks<FlowablePage<WorkflowTask>>({
          ...commonFilters,
          start: 0,
          size: 100,
          processDefinitionKey: rule.processDefinitionKey,
          taskDefinitionKey: rule.taskDefinitionKey,
        }),
      );
    }

    const results = await Promise.all(pagePromises);
    const uniqueTasks = new Map<string, WorkflowTask>();

    for (const res of results) {
      for (const task of res.data ?? []) {
        if (!task.assignee) {
          uniqueTasks.set(task.id, task);
        }
      }
    }

    const allTasks = Array.from(uniqueTasks.values());
    const pagedData = allTasks.slice(start, start + size);

    return {
      data: pagedData,
      total: allTasks.length,
      start,
      size,
      sort: 'createTime',
      order: 'desc',
    };
  }

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
