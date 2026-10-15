import { Module } from '@nestjs/common';
import { InstancesController } from './instances.controller.js';
import { InstancesService } from './instances.service.js';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';

@Module({
  imports: [FlowableModule],
  controllers: [InstancesController],
  providers: [InstancesService],
  exports: [InstancesService],
})
export class InstancesModule {}
