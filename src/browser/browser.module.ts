import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NodesModule } from '../nodes/nodes.module';
import { ServersModule } from '../servers/servers.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { Device, DeviceSchema } from '../users/schemas/device.schema';
import { BrowserController } from './browser.controller';
import { BrowserService } from './browser.service';

@Module({
  imports: [
    ServersModule,
    NodesModule,
    TelemetryModule,
    MongooseModule.forFeature([{ name: Device.name, schema: DeviceSchema }]),
  ],
  controllers: [BrowserController],
  providers: [BrowserService],
})
export class BrowserModule {}
