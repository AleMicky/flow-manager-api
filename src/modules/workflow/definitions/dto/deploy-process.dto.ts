
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';

export class DeployProcessDto {
    @ApiProperty({
        example: 'solicitud-adquisiciones',
        description: 'Nombre del recurso BPMN, sin extensión',
    })
    @IsString()
    @Matches(/^[a-zA-Z0-9_-]+$/)
    @MaxLength(100)
    name!: string;

    @ApiProperty({
        description: 'Contenido XML BPMN 2.0',
        example:
            '<?xml version="1.0" encoding="UTF-8"?><definitions ...>...</definitions>',
    })
    @IsString()
    @MinLength(50)
    @MaxLength(1_000_000)
    xml!: string;

    @ApiPropertyOptional({
        description: 'Tenant de Flowable, si aplica',
    })
    @IsOptional()
    @IsString()
    @Matches(/^[a-zA-Z0-9_-]+$/)
    @MaxLength(100)
    tenantId?: string;
}
