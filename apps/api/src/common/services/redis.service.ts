import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private client: any = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.debug('REDIS_URL not configured — Redis disabled');
      return;
    }

    try {
      // Import at runtime to keep typecheck/install optional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const IORedis = require('ioredis');
      this.client = new IORedis(url);
      this.client.on('error', (e: any) => this.logger.error('Redis error', e));
      this.logger.log('Connected to Redis');
    } catch (e) {
      this.logger.warn('Failed to initialize ioredis client — continuing without Redis');
      this.client = null;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    const v = await this.client.get(key);
    return v !== null;
  }

  async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    if (!this.client) return;
    await this.client.set(key, value, 'EX', ttlSeconds);
  }
}
