import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class StartProcessDto {
  @ApiProperty({
    example: 'solicitudCompra',
    description: 'Clave de la definición BPMN',
  })
  @IsString()
  @IsNotEmpty()
  processDefinitionKey!: string;

  @ApiPropertyOptional({
    example: 'COMP-2026-001',
    description: 'Identificador de negocio',
  })
  @IsOptional()
  @IsString()
  businessKey?: string;

  @ApiPropertyOptional({
    example: {
      solicitante: 'Miguel',
      concepto: 'Compra de computadoras',
      monto: 8500,
    },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
