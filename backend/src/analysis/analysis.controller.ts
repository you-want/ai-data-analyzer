import { Controller, Get } from '@nestjs/common';

@Controller('analysis')
export class AnalysisController {
  @Get()
  getHello(): string {
    return 'Hello from Analysis!';
  }
}
