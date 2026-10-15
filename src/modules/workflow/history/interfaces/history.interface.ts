
export interface HistoricProcessInstance {
    id: string;
    processDefinitionId: string;
    processDefinitionKey?: string;
    businessKey: string | null;
    startTime: string;
    endTime: string | null;
    durationInMillis: number | null;
    startUserId: string | null;
    deleteReason?: string | null;
}

export interface HistoricTaskInstance {
    id: string;
    name: string;
    taskDefinitionKey: string | null;
    processInstanceId: string;
    assignee: string | null;
    startTime: string;
    endTime: string | null;
    durationInMillis: number | null;
    deleteReason?: string | null;
}

export interface FlowablePage<T> {
    data: T[];
    total: number;
    start: number;
    size: number;
    sort: string | null;
    order: string | null;
}
