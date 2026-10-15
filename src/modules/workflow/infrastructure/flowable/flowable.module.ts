import { Module } from '@nestjs/common';

import { FlowableService } from './flowable.service.js';
import { FlowableClient } from './flowable.client.js';

@Module({
  providers: [FlowableClient, FlowableService],
  exports: [FlowableService],
})
export class FlowableModule {}
