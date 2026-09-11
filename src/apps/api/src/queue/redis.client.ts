// In-memory stub — no Redis needed for local dev.
// Replace with a real ioredis/redis client in production.

class InMemoryRedis {
  private store = new Map<string, { v: number | Record<string, string>; exp?: number }>();

  private alive(key: string): boolean {
    const e = this.store.get(key);
    if (!e) return false;
    if (e.exp && Date.now() > e.exp) { this.store.delete(key); return false; }
    return true;
  }

  async incr(key: string): Promise<number> {
    const cur = this.alive(key) ? (this.store.get(key)!.v as number) : 0;
    const next = cur + 1;
    this.store.set(key, { v: next, exp: this.store.get(key)?.exp });
    return next;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const e = this.store.get(key);
    if (e) this.store.set(key, { ...e, exp: Date.now() + seconds * 1000 });
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    if (!this.alive(key)) this.store.set(key, { v: {} });
    const hash = this.store.get(key)!.v as Record<string, string>;
    const next = Number(hash[field] ?? 0) + increment;
    hash[field] = String(next);
    return next;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.alive(key)) return {};
    return { ...(this.store.get(key)!.v as Record<string, string>) };
  }
}

export const redis = new InMemoryRedis();
