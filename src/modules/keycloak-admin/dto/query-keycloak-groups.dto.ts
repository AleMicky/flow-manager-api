import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryKeycloakGroupsDto {
  @ApiPropertyOptional({
    description: 'Texto de búsqueda para filtrar grupos por nombre',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    default: 0,
    description: 'Desplazamiento inicial (offset)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  first: number = 0;

  @ApiPropertyOptional({
    default: 50,
    description: 'Cantidad máxima de grupos a devolver',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  max: number = 50;
}

