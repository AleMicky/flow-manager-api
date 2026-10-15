import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryHistoryDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  start: number = 0;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  processInstanceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  processDefinitionKey?: string;
}
