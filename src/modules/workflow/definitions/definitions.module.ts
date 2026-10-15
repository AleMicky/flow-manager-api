import { Module } from '@nestjs/common';
import { DefinitionsController } from './definitions.controller.js';
import { DefinitionsService } from './definitions.service.js';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';

@Module({
  imports: [FlowableModule],
  controllers: [DefinitionsController],
  providers: [DefinitionsService],
  exports: [DefinitionsService],
})
export class DefinitionsModule {}
