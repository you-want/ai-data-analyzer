import { Global, Module } from '@nestjs/common';
import { FallbackService } from './fallback.service';
import { OpenAIModule } from '../openai/openai.module';

@Global()
@Module({
  imports: [OpenAIModule],
  providers: [FallbackService],
  exports: [FallbackService],
})
export class TenacityModule {}
