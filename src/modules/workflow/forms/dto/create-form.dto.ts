import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFormDto {
  @ApiPropertyOptional({
    description: 'Clave del proceso BPMN (aplica a todas las versiones del proceso)',
  })
  @IsOptional()
  @IsString()
  processDefinitionKey?: string;

  @ApiPropertyOptional({
    description: 'ID específico de la versión desplegada en Flowable',
  })
  @IsOptional()
  @IsString()
  processDefinitionId?: string;

  @ApiProperty({ example: 'taskVerificarExistencias' })
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
