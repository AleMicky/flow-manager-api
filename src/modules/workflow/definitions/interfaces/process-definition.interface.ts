export interface ProcessDefinition {
  id: string;
  url: string;
  key: string;
  name: string;
  description: string | null;
  version: number;
  category: string | null;
  deploymentId: string;
  resource: string;
  diagramResource: string | null;
  suspended: boolean;
  tenantId: string;
}

export interface FlowablePage<T> {
  data: T[];
  total: number;
  start: number;
  sort: string | null;
  order: string | null;
  size: number;
}
