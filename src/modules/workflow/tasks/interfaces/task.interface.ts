export interface WorkflowTask {
  id: string;
  name: string;
  description: string | null;
  assignee: string | null;
  owner: string | null;
  priority: number;
  createTime: string;
  dueDate: string | null;
  suspended: boolean;
  taskDefinitionKey: string | null;
  processInstanceId: string | null;
  processDefinitionId: string | null;
  tenantId: string | null;
}

export interface FlowablePage<T> {
  data: T[];
  total: number;
  start: number;
  size: number;
  sort: string | null;
  order: string | null;
}
