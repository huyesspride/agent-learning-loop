import type { SessionSource } from '@cll/shared';

export class SourceRegistry {
  private sources = new Map<string, SessionSource>();

  register(source: SessionSource): void {
    this.sources.set(source.id, source);
  }

  get(id: string): SessionSource | undefined {
    return this.sources.get(id);
  }

  getEnabled(): SessionSource[] {
    return Array.from(this.sources.values());
  }
}

export const registry = new SourceRegistry();
