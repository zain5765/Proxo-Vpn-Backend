import { Module } from '@nestjs/common';
import { ServersModule } from '../servers/servers.module';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';

@Module({
  imports: [ServersModule],
  controllers: [StatusController],
  providers: [StatusService],
})
export class StatusModule {}
