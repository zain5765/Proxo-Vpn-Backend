import { Module } from '@nestjs/common';
import { NodeAgentClient } from './node-agent.client';

@Module({
  providers: [NodeAgentClient],
  exports: [NodeAgentClient],
})
export class NodesModule {}
