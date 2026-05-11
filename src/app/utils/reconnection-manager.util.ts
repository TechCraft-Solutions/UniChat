export interface ReconnectionManagerConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterPercentage?: number;
}

export interface ReconnectionState {
  attempts: number;
  currentDelayMs: number;
}

export class ReconnectionManager {
  private attempts = 0;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterPercentage: number;

  constructor(config: ReconnectionManagerConfig) {
    this.maxRetries = config.maxRetries;
    this.baseDelayMs = config.baseDelayMs;
    this.maxDelayMs = config.maxDelayMs;
    this.jitterPercentage = config.jitterPercentage ?? 0;
  }

  onSuccessfulConnection(): void {
    this.attempts = 0;
  }

  onConnectionFailed(): number {
    const delay = this.calculateDelay();
    this.attempts++;
    return delay;
  }

  shouldRetry(): boolean {
    return this.attempts < this.maxRetries;
  }

  reset(): void {
    this.attempts = 0;
  }

  getState(): ReconnectionState {
    return {
      attempts: this.attempts,
      currentDelayMs: this.calculateDelay(),
    };
  }

  private calculateDelay(): number {
    const exponentialDelay = this.baseDelayMs * Math.pow(2, this.attempts);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);

    if (this.jitterPercentage <= 0) {
      return cappedDelay;
    }

    const jitter = cappedDelay * this.jitterPercentage * (Math.random() - 0.5);
    return Math.max(this.baseDelayMs * 0.5, cappedDelay + jitter);
  }
}
