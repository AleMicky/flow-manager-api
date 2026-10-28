import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { FlowableService } from '../../infrastructure/flowable/flowable.service.js';
import { TaskAssignmentsService } from './task-assignments.service.js';

import type { AuthUser } from '../../../auth/interfaces/auth-user.interface.js';

export interface FlowableTask {
  id: string;
  name: string;
  assignee: string | null;
  processInstanceId: string | null;
  processDefinitionId: string | null;
  taskDefinitionKey: string | null;
}

interface IdentityLink {
  type: string;
  userId: string | null;
  groupId: string | null;
}

@Injectable()
export class TaskAuthorizationService {
  constructor(
    private readonly flowable: FlowableService,
    private readonly taskAssignments: TaskAssignmentsService,
  ) {}

  private async getTask(taskId: string): Promise<FlowableTask> {
    return this.flowable.getTaskById<FlowableTask>(taskId);
  }

  private async isCandidate(
    task: FlowableTask,
    user: AuthUser,
  ): Promise<boolean> {
    const effectiveGroups =
      await this.taskAssignments.getUserEffectiveGroupsAndRoles(user);

    const processDefinitionKey = task.processDefinitionId?.split(':')[0];

    if (processDefinitionKey && task.taskDefinitionKey) {
      const rule = await this.taskAssignments.findByProcessAndTask(
        processDefinitionKey,
        task.taskDefinitionKey,
      );

      if (
        rule &&
        rule.active &&
        (rule.candidateGroups.length > 0 || rule.candidateUsers.length > 0)
      ) {
        const isUserAllowed =
          rule.candidateUsers.includes(user.id) ||
          rule.candidateUsers.includes(user.username);
        const isGroupAllowed = rule.candidateGroups.some((g) =>
          effectiveGroups.includes(g),
        );

        if (isUserAllowed || isGroupAllowed) {
          return true;
        }
      }
    }

    const links = await this.flowable.getTaskIdentityLinks<IdentityLink[]>(
      task.id,
    );

    return links.some((link) => {
      if (link.type !== 'candidate') {
        return false;
      }

      if (link.userId === user.id || link.userId === user.username) {
        return true;
      }

      return (
        link.groupId !== null && effectiveGroups.includes(link.groupId)
      );
    });
  }

  async claim(taskId: string, user: AuthUser): Promise<FlowableTask> {
    const task = await this.getTask(taskId);

    if (task.assignee === user.id) {
      return task;
    }

    if (task.assignee) {
      throw new ConflictException(
        'La tarea ya fue reclamada por otro usuario',
      );
    }

    const allowed = await this.isCandidate(task, user);

    if (!allowed) {
      throw new ForbiddenException(
        'No eres candidato para esta tarea (verifica los grupos asignados a esta tarea BPMN)',
      );
    }

    await this.flowable.claimTask<unknown>(taskId, user.id);

    return this.getTask(taskId);
  }

  async unclaim(taskId: string, user: AuthUser): Promise<void> {
    const task = await this.getTask(taskId);

    if (task.assignee !== user.id) {
      throw new ForbiddenException(
        'Solo el asignado puede liberar la tarea',
      );
    }

    await this.flowable.unclaimTask<unknown>(taskId);
  }

  async assertCanExecute(
    taskId: string,
    user: AuthUser,
  ): Promise<FlowableTask> {
    const task = await this.getTask(taskId);

    if (task.assignee !== user.id) {
      throw new ForbiddenException(
        'Debes reclamar la tarea antes de ejecutarla',
      );
    }

    return task;
  }
}
