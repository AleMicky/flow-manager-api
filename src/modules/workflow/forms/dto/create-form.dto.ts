
import {
    ApiProperty,
    ApiPropertyOptional,
} from '@nestjs/swagger';

import {
    IsBoolean,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

export class CreateFormDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    processDefinitionId!: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    taskDefinitionKey!: string;

    @ApiProperty({ example: 'Revisar solicitud' })
    @IsString()
    @MaxLength(150)
    title!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        description: 'Esquema JSON del formulario',
    })
    @IsObject()
    schema!: Record<string, unknown>;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    active?: boolean;
}
