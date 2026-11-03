import { Injectable } from '@nestjs/common';
import { FlowableClient } from './flowable.client.js';

@Injectable()
export class FlowableService {
  constructor(private readonly client: FlowableClient) {}

  getDefinitions<T = unknown>(params?: Record<string, unknown>): Promise<T> {
    return this.client.get<T>('/repository/process-definitions', params);
  }

  getInstances<T = unknown>(params?: Record<string, unknown>): Promise<T> {
    return this.client.get<T>('/runtime/process-instances', params);
  }

  startProcess<T = unknown>(
    processDefinitionKey: string,
    variables: Record<string, unknown> = {},
    businessKey?: string,
    startUserId?: string,
  ): Promise<T> {
    return this.client.post<T>('/runtime/process-instances', {
      processDefinitionKey,
      businessKey,
      ...(startUserId ? { startUserId } : {}),
      variables: Object.entries(variables).map(([name, value]) => ({
        name,
        value,
      })),
    });
  }

  completeTask<T = unknown>(
    taskId: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    return this.client.post<T>(`/runtime/tasks/${encodeURIComponent(taskId)}`, {
      action: 'complete',
      variables: Object.entries(variables).map(([name, value]) => ({
        name,
        value,
      })),
    });
  }

  getHistory<T = unknown>(): Promise<T> {
    return this.client.get<T>('/history/historic-process-instances');
  }

  getDefinitionById<T>(id: string): Promise<T> {
    return this.client.get<T>(
      `/repository/process-definitions/${encodeURIComponent(id)}`,
    );
  }

  getDefinitionXml(id: string): Promise<string> {
    return this.client.get<string>(
      `/repository/process-definitions/${encodeURIComponent(id)}/resourcedata`,
    );
  }

  getInstancesFiltered<T>(params: Record<string, unknown>): Promise<T> {
    return this.client.get<T>('/runtime/process-instances', params);
  }

  getInstanceById<T>(id: string): Promise<T> {
    return this.client.get<T>(
      `/runtime/process-instances/${encodeURIComponent(id)}`,
    );
  }

  getInstanceVariables<T = Array<{ name: string; value: unknown }>>(
    instanceId: string,
  ): Promise<T> {
    return this.client.get<T>(
      `/runtime/process-instances/${encodeURIComponent(instanceId)}/variables`,
    );
  }

  getHistoricVariables<T = unknown>(
    instanceId: string,
  ): Promise<T> {
    return this.client.get<T>('/history/historic-variable-instances', {
      processInstanceId: instanceId,
      size: 100,
    });
  }

  getInstanceDiagram(
    id: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    return this.client.getBuffer(
      `/runtime/process-instances/${encodeURIComponent(id)}/diagram`,
    );
  }

  getDefinitionImage(
    id: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    return this.client.getBuffer(
      `/repository/process-definitions/${encodeURIComponent(id)}/image`,
    );
  }

  deleteInstance(id: string, reason: string): Promise<void> {
    return this.client.delete<void>(
      `/runtime/process-instances/${encodeURIComponent(id)}`,
      { deleteReason: reason },
    );
  }

  // ==========================================
  // TASKS
  // ==========================================

  getTasks<T>(params?: Record<string, unknown>): Promise<T> {
    return this.client.get<T>('/runtime/tasks', params);
  }

  getTaskById<T>(taskId: string): Promise<T> {
    return this.client.get<T>(`/runtime/tasks/${encodeURIComponent(taskId)}`);
  }

  getTaskVariables<T = Array<{ name: string; value: unknown }>>(
    taskId: string,
  ): Promise<T> {
    return this.client.get<T>(
      `/runtime/tasks/${encodeURIComponent(taskId)}/variables`,
    );
  }

  claimTask<T>(taskId: string, assignee: string): Promise<T> {
    return this.client.post<T>(`/runtime/tasks/${encodeURIComponent(taskId)}`, {
      action: 'claim',
      assignee,
    });
  }

  unclaimTask<T>(taskId: string): Promise<T> {
    return this.client.post<T>(`/runtime/tasks/${encodeURIComponent(taskId)}`, {
      action: 'claim',
      assignee: null,
    });
  }

  setTaskAssignee<T>(taskId: string, assignee: string | null): Promise<T> {
    return this.client.post<T>(`/runtime/tasks/${encodeURIComponent(taskId)}`, {
      action: 'claim',
      assignee,
    });
  }

  getTaskIdentityLinks<T>(taskId: string): Promise<T> {
    return this.client.get<T>(
      `/runtime/tasks/${encodeURIComponent(taskId)}/identitylinks`,
    );
  }

  getTaskCandidateGroups<T>(taskId: string): Promise<T> {
    return this.getTaskIdentityLinks<T>(taskId);
  }

  addTaskCandidateGroup<T = unknown>(
    taskId: string,
    groupId: string,
  ): Promise<T> {
    return this.client.post<T>(
      `/runtime/tasks/${encodeURIComponent(taskId)}/identitylinks`,
      {
        group: groupId,
        type: 'candidate',
      },
    );
  }

  removeTaskCandidateGroup(taskId: string, groupId: string): Promise<void> {
    return this.client.delete<void>(
      `/runtime/tasks/${encodeURIComponent(taskId)}/identitylinks/groups/${encodeURIComponent(groupId)}/candidate`,
    );
  }

  addTaskCandidateUser<T = unknown>(
    taskId: string,
    userId: string,
  ): Promise<T> {
    return this.client.post<T>(
      `/runtime/tasks/${encodeURIComponent(taskId)}/identitylinks`,
      {
        user: userId,
        type: 'candidate',
      },
    );
  }

  removeTaskCandidateUser(taskId: string, userId: string): Promise<void> {
    return this.client.delete<void>(
      `/runtime/tasks/${encodeURIComponent(taskId)}/identitylinks/users/${encodeURIComponent(userId)}/candidate`,
    );
  }

  // ==========================================
  // HISTORY
  // ==========================================

  getHistoricProcesses<T>(params?: Record<string, unknown>): Promise<T> {
    return this.client.get<T>('/history/historic-process-instances', params);
  }

  getHistoricProcessById<T>(id: string): Promise<T> {
    return this.client.get<T>(
      `/history/historic-process-instances/${encodeURIComponent(id)}`,
    );
  }

  getHistoricTasks<T>(params?: Record<string, unknown>): Promise<T> {
    return this.client.get<T>('/history/historic-task-instances', params);
  }

  getHistoricTaskById<T>(id: string): Promise<T> {
    return this.client.get<T>(
      `/history/historic-task-instances/${encodeURIComponent(id)}`,
    );
  }
}
