import { createHash } from "crypto";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("circuit-breaker");

export interface CircuitBreakerState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  expectedExceptionPredicate?: (error: any) => boolean;
  timeout: number;
  fallbackResponse?: string;
}

export class CircuitBreaker {
  private state: Map<string, CircuitBreakerState> = new Map();
  private config: CircuitBreakerConfig;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private destroyed = false;

  constructor(config: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000,
      timeout: 30000,
      ...config,
    };
  }

  private getKey(adminId: string, operation: string): string {
    return createHash("md5").update(`${adminId}:${operation}`).digest("hex");
  }

  private getState(adminId: string, operation: string): CircuitBreakerState {
    const key = this.getKey(adminId, operation);
    let state = this.state.get(key);

    if (!state) {
      state = {
        state: "CLOSED",
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
      };
      this.state.set(key, state);
    }

    if (Date.now() - state.lastFailureTime > this.config.monitoringPeriod) {
      this.resetState(key, state);
    }

    return state;
  }

  private resetState(key: string, state: CircuitBreakerState): void {
    state.state = "CLOSED";
    state.failureCount = 0;
    state.successCount = 0;
    state.consecutiveFailures = 0;
    state.consecutiveSuccesses = 0;
    state.nextAttemptTime = 0;
    this.state.delete(key);
  }

  private shouldAllowRequest(adminId: string, operation: string): boolean {
    const state = this.getState(adminId, operation);
    const now = Date.now();

    if (state.state === "CLOSED") return true;

    if (state.state === "OPEN") {
      if (now >= state.nextAttemptTime) {
        state.state = "HALF_OPEN";
        state.consecutiveSuccesses = 0;
        return true;
      }
      return false;
    }

    return true;
  }

  private recordSuccess(adminId: string, operation: string): void {
    const key = this.getKey(adminId, operation);
    const state = this.state.get(key);
    if (!state) return;

    state.successCount++;
    state.consecutiveSuccesses++;
    state.consecutiveFailures = 0;
    state.lastFailureTime = 0;

    if (state.state === "HALF_OPEN" && state.consecutiveSuccesses >= 3) {
      state.state = "CLOSED";
      state.consecutiveSuccesses = 0;
      log.info({ adminId, operation }, "Circuit closed after successful recovery");
    }
  }

  private recordFailure(adminId: string, operation: string, error: any): void {
    const key = this.getKey(adminId, operation);
    const state = this.state.get(key);
    if (!state) return;

    state.failureCount++;
    state.consecutiveFailures++;
    state.consecutiveSuccesses = 0;
    state.lastFailureTime = Date.now();

    if (state.state === "HALF_OPEN") {
      this.openCircuit(key, state);
    } else if (state.state === "CLOSED" && state.consecutiveFailures >= this.config.failureThreshold) {
      this.openCircuit(key, state);
    }

    log.info({ adminId, operation, state: state.state, failures: state.consecutiveFailures }, "Failure recorded");
  }

  private openCircuit(key: string, state: CircuitBreakerState): void {
    state.state = "OPEN";
    state.nextAttemptTime = Date.now() + this.config.resetTimeout;
    state.consecutiveFailures = 0;

    log.info({ key, resetMs: this.config.resetTimeout }, "Circuit opened");
    this.setupMonitoring(key);
  }

  private setupMonitoring(key: string): void {
    if (this.destroyed) return;
    this.clearMonitoring(key);

    const interval = setInterval(() => {
      if (this.destroyed) {
        clearInterval(interval);
        return;
      }
      const state = this.state.get(key);
      if (state && state.state === "OPEN" && Date.now() >= state.nextAttemptTime) {
        log.info({ key }, "Monitoring: Circuit ready for half-open state");
      }
    }, 10000);

    this.monitoringIntervals.set(key, interval);
  }

  private clearMonitoring(key: string): void {
    const existing = this.monitoringIntervals.get(key);
    if (existing) {
      clearInterval(existing);
      this.monitoringIntervals.delete(key);
    }
  }

  async execute<T>(
    adminId: string,
    operation: string,
    operationFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>,
  ): Promise<T> {
    if (this.destroyed) {
      throw new Error("Circuit breaker has been destroyed");
    }

    const key = this.getKey(adminId, operation);
    const state = this.getState(adminId, operation);

    if (!this.shouldAllowRequest(adminId, operation)) {
      log.info({ adminId, operation }, "Circuit OPEN — using fallback");

      if (this.config.fallbackResponse) {
        return this.config.fallbackResponse as T;
      }
      if (fallbackFn) {
        return fallbackFn();
      }
      throw new Error(`Circuit breaker is OPEN for ${operation}. Try again later.`);
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), this.config.timeout);
    });

    try {
      const result = await Promise.race([operationFn(), timeoutPromise]);
      this.recordSuccess(adminId, operation);
      return result;
    } catch (error: any) {
      if (this.config.expectedExceptionPredicate?.(error)) {
        this.recordSuccess(adminId, operation);
        throw error;
      }
      this.recordFailure(adminId, operation, error);

      if (this.config.fallbackResponse) {
        return this.config.fallbackResponse as T;
      }
      if (fallbackFn) {
        return fallbackFn();
      }
      throw error;
    }
  }

  getStateInfo(adminId: string, operation: string): CircuitBreakerState | null {
    const key = this.getKey(adminId, operation);
    return this.state.get(key) || null;
  }

  getAllStates(): Map<string, CircuitBreakerState> {
    return new Map(this.state);
  }

  resetAll(): void {
    this.state.clear();
    this.monitoringIntervals.forEach((interval) => clearInterval(interval));
    this.monitoringIntervals.clear();
    log.info("All circuit breakers reset");
  }

  destroy(): void {
    this.destroyed = true;
    this.resetAll();
  }
}

export const aiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000,
  monitoringPeriod: 300000,
  timeout: 30000,
  fallbackResponse:
    "Hello! I'm experiencing some technical difficulties right now. Please try again in a few minutes, or contact our support team if the issue persists. Thank you for your patience!",
});

export async function executeWithCircuitBreaker<T>(
  adminId: string,
  operation: string,
  operationFn: () => Promise<T>,
  fallbackFn?: () => Promise<T>,
): Promise<T> {
  return aiCircuitBreaker.execute(adminId, operation, operationFn, fallbackFn);
}
