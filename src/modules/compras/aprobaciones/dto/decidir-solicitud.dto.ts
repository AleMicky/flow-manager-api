
import {
    ApiProperty,
    ApiPropertyOptional,
} from '@nestjs/swagger';

import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
} from 'class-validator';

import { DecisionCompra } from '../enums/decision-compra.enum.js';

export class DecidirSolicitudDto {
    @ApiProperty({
        description: 'Identificador de la tarea BPMN',
    })
    @IsUUID()
    taskId!: string;

    @ApiProperty({
        enum: DecisionCompra,
        example: DecisionCompra.APROBADO,
    })
    @IsEnum(DecisionCompra)
    decision!: DecisionCompra;

    @ApiPropertyOptional({
        example: 'Solicitud de compra autorizada',
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    observacion?: string;
}
