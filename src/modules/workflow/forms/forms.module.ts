import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowForm } from './entities/workflow-form.entity.js';
import { FormsController } from './forms.controller.js';
import { FormsService } from './forms.service.js';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowForm]),
    FlowableModule,
  ],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule { }
