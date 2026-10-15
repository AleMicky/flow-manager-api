import { Injectable } from '@nestjs/common';
import { FlowableClient } from './flowable.client.js';

@Injectable()
export class FlowableService {
  constructor(private readonly client: FlowableClient) { }

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
  ): Promise<T> {
    return this.client.post<T>('/runtime/process-instances', {
      processDefinitionKey,
      businessKey,
      variables: Object.entries(variables).map(([name, value]) => ({
        name,
        value,
      })),
    });
  }



  completeTask<T = unknown>(taskId: string, variables: Record<string, unknown> = {}): Promise<T> {
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


  getInstancesFiltered<T>(
    params: Record<string, unknown>,
  ): Promise<T> {
    return this.client.get<T>(
      '/runtime/process-instances',
      params,
    );
  }

  getInstanceById<T>(id: string): Promise<T> {
    return this.client.get<T>(
      `/runtime/process-instances/${encodeURIComponent(id)}`,
    );
  }

  deleteInstance(
    id: string,
    reason: string,
  ): Promise<void> {
    return this.client.delete<void>(
      `/runtime/process-instances/${encodeURIComponent(id)}`,
      { deleteReason: reason },
    );
  }


  // ==========================================
  // TASKS
  // ==========================================

  getTasks<T>(
    params?: Record<string, unknown>,
  ): Promise<T> {
    return this.client.get<T>(
      '/runtime/tasks',
      params,
    );
  }

  getTaskById<T>(taskId: string): Promise<T> {
    return this.client.get<T>(
      `/runtime/tasks/${encodeURIComponent(taskId)}`,
    );
  }

  claimTask<T>(
    taskId: string,
    assignee: string,
  ): Promise<T> {
    return this.client.post<T>(
      `/runtime/tasks/${encodeURIComponent(taskId)}`,
      {
        action: 'claim',
        assignee,
      },
    );
  }

  unclaimTask<T>(taskId: string): Promise<T> {
    return this.client.post<T>(
      `/runtime/tasks/${encodeURIComponent(taskId)}`,
      {
        action: 'claim',
        assignee: null,
      },
    );
  }




}
