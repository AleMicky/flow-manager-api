import { Injectable } from '@nestjs/common';

import { FlowableService } from '../infrastructure/flowable/flowable.service.js';
import { QueryHistoryDto } from './dto/query-history.dto.js';

import type {
  FlowablePage,
  HistoricProcessInstance,
  HistoricTaskInstance,
} from './interfaces/history.interface.js';

@Injectable()
export class HistoryService {
  constructor(private readonly flowable: FlowableService) {}

  findProcesses(query: QueryHistoryDto) {
    return this.flowable.getHistoricProcesses<
      FlowablePage<HistoricProcessInstance>
    >({
      start: query.start,
      size: query.size,
      ...(query.processInstanceId && {
        processInstanceId: query.processInstanceId,
      }),
      ...(query.processDefinitionKey && {
        processDefinitionKey: query.processDefinitionKey,
      }),
    });
  }

  findProcessById(id: string) {
    return this.flowable.getHistoricProcessById<HistoricProcessInstance>(id);
  }

  findTasks(query: QueryHistoryDto) {
    return this.flowable.getHistoricTasks<FlowablePage<HistoricTaskInstance>>({
      start: query.start,
      size: query.size,
      ...(query.processInstanceId && {
        processInstanceId: query.processInstanceId,
      }),
      ...(query.processDefinitionKey && {
        processDefinitionKey: query.processDefinitionKey,
      }),
    });
  }

  findTaskById(id: string) {
    return this.flowable.getHistoricTaskById<HistoricTaskInstance>(id);
  }
}
