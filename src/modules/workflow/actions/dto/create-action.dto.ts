import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateActionDto {
  @ApiProperty({
    example: 'solicitudCompra:2:uuid',
  })
  @IsString()
  @IsNotEmpty()
  processDefinitionId!: string;

  @ApiProperty({
    example: 'revisarSolicitud',
  })
  @IsString()
  @IsNotEmpty()
  taskDefinitionKey!: string;

  @ApiProperty({ example: 'aprobar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @ApiProperty({ example: 'Aprobar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  label!: string;

  @ApiProperty({
    example: { decision: 'APROBADO' },
  })
  @IsObject()
  variables!: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Estado de negocio a asignar al completar la acción (ej. APROBADO, RECHAZADO)',
    example: 'APROBADO',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessStatus?: string;
}

