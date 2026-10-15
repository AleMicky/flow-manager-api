
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsInt,
    IsOptional,
    IsString,
    IsBoolean,
    Max,
    Min,
} from 'class-validator';

export class QueryTasksDto {
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
    assignee?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    candidateGroup?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    processInstanceId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    unassigned?: boolean;
}
