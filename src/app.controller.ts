import { Controller, Get } from '@nestjs/common';
import { FlowableService } from './modules/workflow/infrastructure/flowable/flowable.service.js';

@Controller()
export class AppController {
  constructor(private readonly flowable: FlowableService) {}

  @Get('health/flowable')
  checkFlowable() {
    return this.flowable.getDefinitions();
  }
}
