import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ElevenLabsService {
  private readonly apiKey: string;
  private readonly voiceId: string;
  private readonly logger = new Logger(ElevenLabsService.name);

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ELEVENLABS_API_KEY') ?? '';
    // Default professional male/female voice ID (Rachel or similar premium voice)
    this.voiceId = this.config.get<string>('ELEVENLABS_VOICE_ID') ?? '21m00Tcm4TlvDq8ikWAM';
  }

  async isAvailable(): Promise<boolean> {
    return true; // We always have Google TTS as a fallback
  }

  /**
   * Converts text to speech and returns the base64-encoded audio/mpeg stream.
   * Falls back to Google TTS if ElevenLabs key is not set or fails.
   */
  async textToSpeech(text: string): Promise<string | null> {
    const cleanedApiKey = this.apiKey.replace(/^["']|["']$/g, '');
    if (cleanedApiKey) {
      try {
        const cleanedVoiceId = this.voiceId.replace(/^["']|["']$/g, '');
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${cleanedVoiceId}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': cleanedApiKey,
              'Content-Type': 'application/json',
              accept: 'audio/mpeg',
            },
            body: JSON.stringify({
              text,
              model_id: 'eleven_monolingual_v1',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              },
            }),
            signal: AbortSignal.timeout(15_000), // 15s timeout
          },
        );

        if (response.ok) {
          const buffer = await response.arrayBuffer();
          return Buffer.from(buffer).toString('base64');
        } else {
          const errorText = await response.text();
          this.logger.warn(`ElevenLabs TTS failed: ${errorText}. Falling back to Google TTS.`);
        }
      } catch (error) {
        this.logger.warn({
          msg: 'ElevenLabs TTS threw exception — falling back to Google TTS',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Google TTS Fallback
    try {
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text)}`;
      const response = await fetch(googleTtsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
      } else {
        const errorText = await response.text();
        this.logger.warn(`Google TTS fallback failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      this.logger.warn({
        msg: 'Google TTS fallback threw exception',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    throw new ServiceUnavailableException('TTS generation failed. Both ElevenLabs and Google TTS providers are unavailable.');
  }
}
