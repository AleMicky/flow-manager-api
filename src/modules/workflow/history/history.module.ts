import { Module } from '@nestjs/common';
import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';


@Module({
  imports: [FlowableModule],
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule { }
