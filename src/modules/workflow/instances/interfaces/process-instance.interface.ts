export interface ProcessInstance {
  id: string;
  url: string;
  businessKey: string | null;
  suspended: boolean;
  ended: boolean;
  processDefinitionId: string;
  processDefinitionUrl: string;
  activityId: string | null;
  tenantId: string;
  startUserId?: string | null;
  startTime?: string | null;
  registradoPor?: string | null;
}

export interface FlowablePage<T> {
  data: T[];
  total: number;
  start: number;
  size: number;
  sort: string | null;
  order: string | null;
}
