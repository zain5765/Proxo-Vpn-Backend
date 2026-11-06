import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NodesModule } from '../nodes/nodes.module';
import { ServersModule } from '../servers/servers.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { Device, DeviceSchema } from '../users/schemas/device.schema';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    ServersModule,
    NodesModule,
    TelemetryModule,
    MongooseModule.forFeature([{ name: Device.name, schema: DeviceSchema }]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
