
import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
} from '@nestjs/common';
import {
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';

import { FormsService } from './forms.service.js';
import { CreateFormDto } from './dto/create-form.dto.js';

@ApiTags('Workflow - Forms')
@Controller('workflow/forms')
export class FormsController {
    constructor(
        private readonly service: FormsService,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Configurar formulario dinámico' })
    create(@Body() dto: CreateFormDto) {
        return this.service.create(dto);
    }

    @Get('task/:taskId')
    @ApiOperation({ summary: 'Consultar formulario de una tarea' })
    findByTask(@Param('taskId') taskId: string) {
        return this.service.findByTask(taskId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Consultar formulario por ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.service.findOne(id);
    }
}
