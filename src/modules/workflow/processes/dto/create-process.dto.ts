
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsBoolean,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
} from 'class-validator';

export class CreateProcessDto {
    @ApiProperty({ example: 'adquisiciones' })
    @IsString()
    @Matches(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
    @MaxLength(150)
    key!: string;

    @ApiProperty({ example: 'Gestión de adquisiciones' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    name!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'adquisiciones' })
    @IsString()
    @IsNotEmpty()
    processDefinitionKey!: string;

    @ApiProperty({
        type: 'object',
        additionalProperties: true,
        example: {
            type: 'object',
            properties: {
                descripcion: { type: 'string' },
            },
        },
    })
    @IsObject()
    startFormSchema!: Record<string, unknown>;

    @ApiPropertyOptional({ default: false })
    @IsOptional()
    @IsBoolean()
    active?: boolean;
}
