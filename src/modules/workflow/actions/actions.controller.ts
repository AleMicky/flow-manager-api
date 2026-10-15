
import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
} from '@nestjs/common';

import {
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';

import { ActionsService } from './actions.service.js';
import { CreateActionDto } from './dto/create-action.dto.js';

@ApiTags('Workflow - Actions')
@Controller('workflow/actions')
export class ActionsController {
    constructor(
        private readonly service: ActionsService,
    ) { }

    @Post()
    @ApiOperation({
        summary: 'Configurar una acción BPMN',
    })
    create(@Body() dto: CreateActionDto) {
        return this.service.create(dto);
    }

    @Get()
    @ApiOperation({
        summary: 'Listar acciones de una tarea BPMN',
    })
    @ApiQuery({ name: 'processDefinitionId' })
    @ApiQuery({ name: 'taskDefinitionKey' })
    findByTask(
        @Query('processDefinitionId')
        processDefinitionId: string,
        @Query('taskDefinitionKey')
        taskDefinitionKey: string,
    ) {
        return this.service.findByTask(
            processDefinitionId,
            taskDefinitionKey,
        );
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Consultar una acción configurada',
    })
    findOne(@Param('id') id: string) {
        return this.service.findOne(id);
    }
}
