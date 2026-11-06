import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelemetryEvent, TelemetrySchema } from './telemetry.schema';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TelemetryEvent.name, schema: TelemetrySchema },
    ]),
  ],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
