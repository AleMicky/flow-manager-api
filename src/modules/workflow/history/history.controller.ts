
import {
    Controller,
    Get,
    Param,
    Query,
} from '@nestjs/common';

import {
    ApiTags,
    ApiOperation,
    ApiParam,
} from '@nestjs/swagger';

import { HistoryService } from './history.service.js';
import { QueryHistoryDto } from './dto/query-history.dto.js';

@ApiTags('Workflow - History')
@Controller('workflow/history')
export class HistoryController {
    constructor(
        private readonly historyService: HistoryService,
    ) { }

    @Get('processes')
    @ApiOperation({
        summary: 'Listar historial de procesos',
    })
    findProcesses(@Query() query: QueryHistoryDto) {
        return this.historyService.findProcesses(query);
    }

    @Get('processes/:id')
    @ApiOperation({
        summary: 'Consultar proceso histórico',
    })
    @ApiParam({ name: 'id' })
    findProcessById(@Param('id') id: string) {
        return this.historyService.findProcessById(id);
    }

    @Get('tasks')
    @ApiOperation({
        summary: 'Listar historial de tareas',
    })
    findTasks(@Query() query: QueryHistoryDto) {
        return this.historyService.findTasks(query);
    }

    @Get('tasks/:id')
    @ApiOperation({
        summary: 'Consultar tarea histórica',
    })
    @ApiParam({ name: 'id' })
    findTaskById(@Param('id') id: string) {
        return this.historyService.findTaskById(id);
    }
}
