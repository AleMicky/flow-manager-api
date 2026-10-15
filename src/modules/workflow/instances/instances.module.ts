import { Module } from '@nestjs/common';
import { InstancesController } from './instances.controller.js';
import { InstancesService } from './instances.service.js';

@Module({
  controllers: [InstancesController],
  providers: [InstancesService],
})
export class InstancesModule {}
