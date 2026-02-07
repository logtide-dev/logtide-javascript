enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;

  constructor(
    private threshold: number,
    private resetMs: number,
  ) {}

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  canAttempt(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime >= this.resetMs) {
        this.state = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN - allow one attempt
    return true;
  }

  getState(): string {
    return this.state;
  }
}
