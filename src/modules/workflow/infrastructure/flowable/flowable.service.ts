import { Injectable } from '@nestjs/common';
import { FlowableClient } from './flowable.client.js';

@Injectable()
export class FlowableService {
  constructor(private readonly client: FlowableClient) {}

  getDefinitions<T = unknown>(params?: Record<string, unknown>): Promise<T> {
    return this.client.get<T>('/repository/process-definitions', params);
  }

  getInstances() {
    return this.client.get('/runtime/process-instances');
  }

  startProcess(
    processDefinitionKey: string,
    variables: Record<string, unknown> = {},
    businessKey?: string,
  ) {
    return this.client.post('/runtime/process-instances', {
      processDefinitionKey,
      businessKey,
      variables: Object.entries(variables).map(([name, value]) => ({
        name,
        value,
      })),
    });
  }

  getTasks(params?: Record<string, string>) {
    return this.client.get('/runtime/tasks', params);
  }

  completeTask(taskId: string, variables: Record<string, unknown> = {}) {
    return this.client.post(`/runtime/tasks/${encodeURIComponent(taskId)}`, {
      action: 'complete',
      variables: Object.entries(variables).map(([name, value]) => ({
        name,
        value,
      })),
    });
  }

  getHistory() {
    return this.client.get('/history/historic-process-instances');
  }

  getDefinitionById<T>(id: string): Promise<T> {
    return this.client.get<T>(
      `/repository/process-definitions/${encodeURIComponent(id)}`,
    );
  }
}
