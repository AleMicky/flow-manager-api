import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateDefinitionStatusDto {
  @ApiProperty({
    description: 'Acción a realizar en la definición del proceso',
    enum: ['suspend', 'activate'],
    example: 'suspend',
  })
  @IsIn(['suspend', 'activate'], {
    message: 'La acción debe ser "suspend" o "activate"',
  })
  action: 'suspend' | 'activate';

  @ApiPropertyOptional({
    description:
      'Indica si también se deben suspender o activar las instancias en ejecución del proceso',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  includeProcessInstances?: boolean = false;
}

