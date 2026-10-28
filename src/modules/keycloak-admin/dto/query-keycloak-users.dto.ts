import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryKeycloakUsersDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general por username, nombre, apellido o email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por username',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por correo electrónico',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo/inactivo',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  enabled?: boolean;

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
    default: 20,
    description: 'Cantidad máxima de registros a devolver',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  max: number = 20;
}

