import { Module } from '@nestjs/common';
import { DefinitionsController } from './definitions.controller.js';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';
import { DefinitionsService } from './services/definitions.service.js';
import { BpmnDeploymentService } from './services/bpmn-deployment.service.js';
import { BpmnValidatorService } from './services/bpmn-validator.service.js';

@Module({
  imports: [FlowableModule],
  controllers: [DefinitionsController],
  providers: [DefinitionsService, BpmnDeploymentService, BpmnValidatorService],
  exports: [DefinitionsService, BpmnDeploymentService],
})
export class DefinitionsModule { }
