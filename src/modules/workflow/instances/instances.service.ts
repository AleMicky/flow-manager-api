
import { Injectable } from '@nestjs/common';
import { FlowableService } from '../infrastructure/flowable/flowable.service.js';
import { StartProcessDto } from './dto/start-process.dto.js';
import { QueryInstancesDto } from './dto/query-instances.dto.js';

import type {
    FlowablePage,
    ProcessInstance,
} from './interfaces/process-instance.interface.js';

@Injectable()
export class InstancesService {
    constructor(
        private readonly flowable: FlowableService,
    ) { }

    findAll(query: QueryInstancesDto) {
        return this.flowable.getInstancesFiltered<
            FlowablePage<ProcessInstance>
        >({
            start: query.start,
            size: query.size,
            ...(query.processDefinitionKey && {
                processDefinitionKey: query.processDefinitionKey,
            }),
            ...(query.businessKey && {
                businessKey: query.businessKey,
            }),
        });
    }

    findOne(id: string) {
        return this.flowable.getInstanceById<ProcessInstance>(id);
    }

    start(dto: StartProcessDto) {
        return this.flowable.startProcess<ProcessInstance>(
            dto.processDefinitionKey,
            dto.variables ?? {},
            dto.businessKey,
        );
    }

    remove(id: string) {
        return this.flowable.deleteInstance(
            id,
            'Cancelado desde Flow Manager',
        );
    }
}
