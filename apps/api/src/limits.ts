import { Injectable, OnModuleDestroy, HttpException } from '@nestjs/common';
import Redis from 'ioredis';
import { config } from './config';
@Injectable()
export class Limits implements OnModuleDestroy {
  private redis = config.REDIS_URL ? new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false }) : undefined;
  private buckets = new Map<string, { count: number; until: number }>();
  constructor() { this.redis?.on('error', () => {}); void this.redis?.connect().catch(() => {}); }
  async check(key: string, max: number, seconds: number) {
    if (this.redis?.status === 'ready') {
      const result = await this.redis.eval("local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return c", 1, `limit:${key}`, seconds) as number;
      if (result > max) throw new HttpException('Too many requests. Please try again shortly.', 429);
      return;
    }
    const now = Date.now();
    for (const [k, v] of this.buckets) if (v.until < now) this.buckets.delete(k);
    const bucket = this.buckets.get(key) ?? { count: 0, until: now + seconds * 1000 };
    this.buckets.set(key, bucket);
    if (++bucket.count > max) throw new HttpException('Too many requests. Please try again shortly.', 429);
  }
  async onModuleDestroy() { this.redis?.disconnect(); }
}
