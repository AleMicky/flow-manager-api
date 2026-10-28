import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpsertTaskAssignmentDto {
  @ApiProperty({
    description: 'Clave de la definición del proceso BPMN (ej. aprobacionSimple)',
    example: 'aprobacionSimple',
  })
  @IsString()
  @IsNotEmpty()
  processDefinitionKey!: string;

  @ApiProperty({
    description: 'Identificador de la userTask en el BPMN (ej. revisar)',
    example: 'revisar',
  })
  @IsString()
  @IsNotEmpty()
  taskDefinitionKey!: string;

  @ApiPropertyOptional({
    description: 'Nombre descriptivo de la tarea BPMN',
    example: 'Revisar solicitud',
  })
  @IsOptional()
  @IsString()
  taskName?: string;

  @ApiPropertyOptional({
    description:
      'Nombres de grupos o roles de Keycloak autorizados como candidateGroups',
    type: [String],
    example: ['Aprobadores Gerencia', 'workflow-user'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  candidateGroups?: string[];

  @ApiPropertyOptional({
    description: 'UUIDs de usuarios de Keycloak autorizados como candidateUsers',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  candidateUsers?: string[];

  @ApiPropertyOptional({
    default: true,
    description: 'Indica si la regla de asignación está activa',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

