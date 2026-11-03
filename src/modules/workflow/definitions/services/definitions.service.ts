import { Injectable } from '@nestjs/common';
import { FlowableService } from '../../infrastructure/flowable/flowable.service.js';
import { QueryDefinitionsDto } from '../dto/query-definitions.dto.js';

import type {
  FlowablePage,
  ProcessDefinition,
} from '../interfaces/process-definition.interface.js';

@Injectable()
export class DefinitionsService {
  constructor(private readonly flowableService: FlowableService) { }

  findAll(query: QueryDefinitionsDto) {
    return this.flowableService.getDefinitions<FlowablePage<ProcessDefinition>>(
      {
        start: query.start,
        size: query.size,
        ...(query.name ? { name: query.name } : {}),
        ...(query.key ? { key: query.key } : {}),
        ...(query.latest !== undefined ? { latest: query.latest } : {}),
        ...(query.suspended !== undefined ? { suspended: query.suspended } : {}),
      },
    );
  }

  findOne(id: string) {
    return this.flowableService.getDefinitionById<ProcessDefinition>(id);
  }

  findByKey(key: string) {
    return this.flowableService.getDefinitions<FlowablePage<ProcessDefinition>>(
      {
        key,
        latest: true,
      },
    );
  }

  updateStatus(
    id: string,
    action: 'suspend' | 'activate',
    includeProcessInstances = false,
  ) {
    return this.flowableService.updateDefinitionStatus<ProcessDefinition>(
      id,
      action,
      includeProcessInstances,
    );
  }
}
