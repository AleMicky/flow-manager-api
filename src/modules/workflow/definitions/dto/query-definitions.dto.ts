import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class QueryDefinitionsDto {
  @ApiPropertyOptional({
    default: 0,
    description: 'Posición inicial de paginación',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start: number = 0;

  @ApiPropertyOptional({
    default: 20,
    description: 'Cantidad de resultados',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size: number = 20;

  @ApiPropertyOptional({
    description: 'Nombre del proceso',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Clave del proceso BPMN',
    example: 'solicitudCompra',
  })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional({
    description: 'Filtrar solo la última versión de cada proceso',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  latest?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar por estado suspendido (true) o activo (false)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  suspended?: boolean;
}
