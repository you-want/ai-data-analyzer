import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health(): { status: string; message: string } {
    return {
      status: 'ok',
      message: 'AI Data Analyzer service is up and running!',
    };
  }
}
