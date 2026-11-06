import { Controller, Get } from '@nestjs/common';
import { StatusService } from './status.service';

@Controller('status')
export class StatusController {
  constructor(private readonly status: StatusService) {}

  @Get()
  get() {
    return this.status.publicStatus();
  }
}
