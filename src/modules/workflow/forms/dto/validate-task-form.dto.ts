
import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class ValidateTaskFormDto {
    @ApiProperty({
        example: {
            observacion: 'Solicitud revisada correctamente',
        },
    })
    @IsObject()
    data!: Record<string, unknown>;
}
