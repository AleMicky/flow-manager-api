import { Injectable, Logger } from '@nestjs/common';
import { FlowableService } from '../infrastructure/flowable/flowable.service.js';
import { CorrelativesService } from '../processes/correlatives.service.js';
import { StartProcessDto } from './dto/start-process.dto.js';
import { QueryInstancesDto } from './dto/query-instances.dto.js';

import type {
  FlowablePage,
  ProcessInstance,
} from './interfaces/process-instance.interface.js';

@Injectable()
export class InstancesService {
  private readonly logger = new Logger(InstancesService.name);

  constructor(
    private readonly flowable: FlowableService,
    private readonly correlativesService: CorrelativesService,
  ) {}

  findAll(query: QueryInstancesDto) {
    return this.flowable.getInstancesFiltered<FlowablePage<ProcessInstance>>({
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

  async start(dto: StartProcessDto) {
    // Generación 100% automática del correlativo oficial secuencial (ej: ADQ-001/2026)
    const correlativo = await this.correlativesService.generateNextCorrelative(
      dto.processDefinitionKey,
    );

    const variables = { ...(dto.variables ?? {}) };
    variables.correlativo = correlativo;
    variables.codigoTramite = correlativo;
    variables.businessKey = correlativo;

    this.logger.log(
      `Iniciando proceso [${dto.processDefinitionKey}] con correlativo automático asignado: ${correlativo}`,
    );

    return this.flowable.startProcess<ProcessInstance>(
      dto.processDefinitionKey,
      variables,
      correlativo,
    );
  }

  remove(id: string) {
    return this.flowable.deleteInstance(id, 'Cancelado desde Flow Manager');
  }

  async getDiagram(id: string): Promise<{ data: Buffer; contentType: string }> {
    try {
      return await this.flowable.getInstanceDiagram(id);
    } catch (err) {
      this.logger.debug(
        `No se pudo obtener diagrama en runtime para instancia ${id}, intentando imagen de definición: ${err instanceof Error ? err.message : String(err)}`,
      );
      const instance = await this.findOne(id).catch(() => null);
      if (instance?.processDefinitionId) {
        return await this.flowable.getDefinitionImage(
          instance.processDefinitionId,
        );
      }
      throw err;
    }
  }

  async getVariables(instanceId: string): Promise<Record<string, unknown>> {
    let vars: Array<{
      name?: string;
      value?: unknown;
      variable?: { name: string; value: unknown };
    }> = [];

    try {
      vars = await this.flowable.getInstanceVariables(instanceId);
    } catch {
      try {
        const hist = (await this.flowable.getHistoricVariables(instanceId)) as
          | { data?: typeof vars }
          | typeof vars;
        if (hist && Array.isArray((hist as { data?: typeof vars }).data)) {
          vars = (hist as { data: typeof vars }).data;
        } else if (Array.isArray(hist)) {
          vars = hist;
        } else {
          vars = [];
        }
      } catch {
        vars = [];
      }
    }

    const result: Record<string, unknown> = {};
    if (Array.isArray(vars)) {
      for (const v of vars) {
        const name = v.variable?.name || v.name;
        const value =
          v.variable?.value !== undefined ? v.variable.value : v.value;
        if (name) {
          result[name] = value;
        }
      }
    }
    return result;
  }
}
