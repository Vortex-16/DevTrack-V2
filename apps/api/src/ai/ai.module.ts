import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { NvidiaNimProvider } from './providers/nvidia-nim.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Module({
  controllers: [AiController],
  providers: [AiService, NvidiaNimProvider, GeminiProvider],
  exports: [AiService],
})
export class AiModule {}
