import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateKeycloakRoleDto {
  @ApiProperty({
    description: 'Nombre único del rol en Keycloak',
    example: 'analista-compras',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Descripción del rol',
    example: 'Analista encargado de evaluar compras',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Ámbito del rol: realm o client',
    enum: ['realm', 'client'],
    default: 'realm',
  })
  @IsIn(['realm', 'client'])
  @IsOptional()
  source?: 'realm' | 'client';
}

export class UpdateKeycloakRoleDto {
  @ApiPropertyOptional({
    description: 'Nuevo nombre para el rol',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Descripción del rol',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Ámbito del rol: realm o client',
    enum: ['realm', 'client'],
    default: 'realm',
  })
  @IsIn(['realm', 'client'])
  @IsOptional()
  source?: 'realm' | 'client';
}

export class AssignRoleToUserDto {
  @ApiProperty({
    description: 'Nombre del rol a asignar al usuario',
    example: 'aprobador',
  })
  @IsString()
  @IsNotEmpty()
  roleName!: string;

  @ApiPropertyOptional({
    description: 'Ámbito del rol: realm o client',
    enum: ['realm', 'client'],
    default: 'realm',
  })
  @IsIn(['realm', 'client'])
  @IsOptional()
  source?: 'realm' | 'client';
}

