
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsObject,
    IsOptional,
} from 'class-validator';

export class ExecuteActionDto {
    @ApiPropertyOptional({
        description: 'Variables adicionales de la tarea',
        example: {
            observacion: 'Solicitud revisada correctamente',
        },
    })
    @IsOptional()
    @IsObject()
    variables?: Record<string, unknown>;
}
