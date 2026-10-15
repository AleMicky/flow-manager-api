
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CompleteTaskDto {
    @ApiPropertyOptional({
        description: 'Variables que recibe el proceso BPMN',
        example: {
            decision: 'APROBADO',
            observacion: 'Solicitud autorizada',
        },
    })
    @IsOptional()
    @IsObject()
    variables?: Record<string, unknown>;
}
