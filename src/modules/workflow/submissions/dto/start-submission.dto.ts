
import { ApiProperty } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsObject,
    IsString,
    MaxLength,
} from 'class-validator';

export class StartSubmissionDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(250)
    title!: string;

    @ApiProperty({
        type: 'object',
        additionalProperties: true,
    })
    @IsObject()
    data!: Record<string, unknown>;
}
