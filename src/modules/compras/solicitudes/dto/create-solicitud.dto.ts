import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateSolicitudDto {
  @ApiProperty({
    example: 'COMP-2026-001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  numero!: string;

  @ApiProperty({
    example: 'Compra de computadoras',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  concepto!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    example: '8500.00',
    description: 'Monto mayor a cero, con máximo dos decimales',
  })
  @IsNumberString()
  @Matches(/^(?!0+(?:\.0{1,2})?$)\d+(\.\d{1,2})?$/)
  monto!: string;

  @ApiProperty({
    format: 'uuid',
  })
  @IsUUID()
  solicitanteId!: string;
}
