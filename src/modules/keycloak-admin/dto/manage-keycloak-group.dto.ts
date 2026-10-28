import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateKeycloakGroupDto {
  @ApiProperty({
    description: 'Nombre del grupo en Keycloak',
    example: 'Aprobadores Gerencia',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'UUID del grupo padre si se desea crear como subgrupo',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateKeycloakGroupDto {
  @ApiProperty({
    description: 'Nuevo nombre del grupo en Keycloak',
    example: 'Aprobadores Financieros',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

