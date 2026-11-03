import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WorkflowProcess } from './entities/workflow-process.entity.js';
import { WorkflowCorrelative } from './entities/workflow-correlative.entity.js';

@Injectable()
export class CorrelativesService {
  private readonly logger = new Logger(CorrelativesService.name);

  constructor(
    @InjectRepository(WorkflowProcess)
    private readonly processRepo: Repository<WorkflowProcess>,
    @InjectRepository(WorkflowCorrelative)
    private readonly correlativeRepo: Repository<WorkflowCorrelative>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Genera de forma atómica y concurrente el siguiente código correlativo oficial
   * por proceso y por gestión (ej: ADQ-001/2026).
   */
  async generateNextCorrelative(
    processDefinitionKey: string,
    targetYear: number = new Date().getFullYear(),
  ): Promise<string> {
    // 1. Obtener configuración del proceso (si existe en workflow_processes)
    const process = await this.processRepo.findOne({
      where: [{ processDefinitionKey }, { key: processDefinitionKey }],
    });

    const prefix = process?.codePrefix || 'ADQ';
    const format = process?.correlativeFormat || '{prefix}-{number:3}/{year}';

    // 2. Incrementar secuencialmente de forma atómica en PostgreSQL
    const query = `
      INSERT INTO workflow_correlatives (id, "processDefinitionKey", year, "currentValue", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, 1, NOW())
      ON CONFLICT ("processDefinitionKey", year)
      DO UPDATE SET 
        "currentValue" = workflow_correlatives."currentValue" + 1,
        "updatedAt" = NOW()
      RETURNING "currentValue";
    `;

    const rawResult = await this.dataSource.query(query, [
      processDefinitionKey,
      targetYear,
    ]);

    const nextNumber = Number(rawResult[0]?.currentValue || 1);

    // 3. Formatear la cadena resultante según la plantilla configurada
    let result = format
      .replace('{prefix}', prefix)
      .replace('{year}', String(targetYear));

    // Reemplazar {number:N} o {number}
    result = result.replace(/\{number(?::(\d+))?\}/g, (_match, padding) => {
      const padLength = padding ? parseInt(padding, 10) : 3;
      return String(nextNumber).padStart(padLength, '0');
    });

    this.logger.log(
      `Correlativo generado para [${processDefinitionKey}] (gestión ${targetYear}): ${result}`,
    );

    return result;
  }
}

