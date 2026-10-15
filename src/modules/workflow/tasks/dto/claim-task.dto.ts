import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ClaimTaskDto {
  @ApiProperty({
    example: 'responsable01',
    description: 'Usuario que reclama la tarea',
  })
  @IsString()
  @IsNotEmpty()
  assignee!: string;
}
