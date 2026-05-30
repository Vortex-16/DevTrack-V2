import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { NvidiaNimProvider } from './providers/nvidia-nim.provider';
import { GroqProvider } from './providers/groq.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ElevenLabsService } from './providers/elevenlabs.service';
import { MockProvider } from './providers/mock.provider';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    NvidiaNimProvider,
    GroqProvider,
    GeminiProvider,
    MockProvider,
    ElevenLabsService,
  ],
  exports: [AiService, ElevenLabsService],
})
export class AiModule {}
