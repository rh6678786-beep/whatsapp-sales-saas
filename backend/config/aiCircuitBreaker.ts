import { createHash } from 'crypto';

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  resetTimeout: number; // Time to wait before attempting reset (ms)
  monitoringPeriod: number; // Time window for monitoring (ms)
  expectedExceptionPredicate?: (error: any) => boolean;
  timeout: number; // Request timeout (ms)
  fallbackResponse?: string;
}

export class CircuitBreaker {
  private state: Map<string, CircuitBreakerState> = new Map();
  private config: CircuitBreakerConfig;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      timeout: 30000, // 30 seconds
      ...config,
    };
  }

  private getKey(adminId: string, operation: string): string {
    return createHash('md5').update(`${adminId}:${operation}`).digest('hex');
  }

  private getState(adminId: string, operation: string): CircuitBreakerState {
    const key = this.getKey(adminId, operation);
    let state = this.state.get(key);
    
    if (!state) {
      state = {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
      };
      this.state.set(key, state);
    }

    // Clean up old states
    if (Date.now() - state.lastFailureTime > this.config.monitoringPeriod) {
      this.resetState(key, state);
    }

    return state;
  }

  private resetState(key: string, state: CircuitBreakerState): void {
    state.state = 'CLOSED';
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

    if (state.state === 'CLOSED') {
      return true;
    }

    if (state.state === 'OPEN') {
      if (now >= state.nextAttemptTime) {
        state.state = 'HALF_OPEN';
        state.consecutiveSuccesses = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN state
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

    if (state.state === 'HALF_OPEN') {
      if (state.consecutiveSuccesses >= 3) {
        state.state = 'CLOSED';
        state.consecutiveSuccesses = 0;
        console.log(`[CIRCUIT_BREAKER][${adminId}] Circuit closed after successful recovery`);
      }
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

    if (state.state === 'HALF_OPEN') {
      this.openCircuit(key, state);
    } else if (state.state === 'CLOSED') {
      if (state.consecutiveFailures >= this.config.failureThreshold) {
        this.openCircuit(key, state);
      }
    }

    console.log(`[CIRCUIT_BREAKER][${adminId}] Failure recorded. State: ${state.state}, Consecutive failures: ${state.consecutiveFailures}`);
  }

  private openCircuit(key: string, state: CircuitBreakerState): void {
    state.state = 'OPEN';
    state.nextAttemptTime = Date.now() + this.config.resetTimeout;
    state.consecutiveFailures = 0;
    
    console.log(`[CIRCUIT_BREAKER] Circuit opened for ${key}. Reset in ${this.config.resetTimeout}ms`);
    
    // Set up automatic monitoring
    this.setupMonitoring(key);
  }

  private setupMonitoring(key: string): void {
    // Clear existing monitoring
    if (this.monitoringIntervals.has(key)) {
      clearInterval(this.monitoringIntervals.get(key));
    }

    // Set up new monitoring interval
    const interval = setInterval(() => {
      const state = this.state.get(key);
      if (state && state.state === 'OPEN') {
        if (Date.now() >= state.nextAttemptTime) {
          console.log(`[CIRCUIT_BREAKER][${key}] Monitoring: Circuit ready for half-open state`);
        }
      }
    }, 10000); // Check every 10 seconds

    this.monitoringIntervals.set(key, interval);
  }

  async execute<T>(
    adminId: string,
    operation: string,
    operationFn: () => Promise<T>,
    fallbackFn?: () => Promise<T>
  ): Promise<T> {
    const key = this.getKey(adminId, operation);
    const state = this.getState(adminId, operation);

    // Check if circuit is open
    if (!this.shouldAllowRequest(adminId, operation)) {
      console.log(`[CIRCUIT_BREAKER][${adminId}] Circuit OPEN for ${operation}. Using fallback.`);
      
      if (this.config.fallbackResponse && operationFn.constructor.name === 'AsyncFunction') {
        // For AI operations, return fallback response
        const fallback = this.config.fallbackResponse;
        return Promise.resolve(fallback as T);
      }
      
      if (fallbackFn) {
        return fallbackFn();
      }
      
      throw new Error(`Circuit breaker is OPEN for ${operation}. Try again later.`);
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), this.config.timeout);
    });

    try {
      const result = await Promise.race([operationFn(), timeoutPromise]);
      this.recordSuccess(adminId, operation);
      return result;
    } catch (error: any) {
      // Check if error is expected and should be ignored
      if (this.config.expectedExceptionPredicate?.(error)) {
        this.recordSuccess(adminId, operation);
        throw error;
      }

      this.recordFailure(adminId, operation, error);
      
      if (this.config.fallbackResponse && operationFn.constructor.name === 'AsyncFunction') {
        // For AI operations, return fallback response
        const fallback = this.config.fallbackResponse;
        return Promise.resolve(fallback as T);
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
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals.clear();
    console.log('[CIRCUIT_BREAKER] All circuit breakers reset');
  }

  destroy(): void {
    this.resetAll();
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals.clear();
  }
}

// Global circuit breaker instance
export const aiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  monitoringPeriod: 300000, // 5 minutes
  timeout: 30000, // 30 seconds
  fallbackResponse: "Hello! I'm experiencing some technical difficulties right now. Please try again in a few minutes, or contact our support team if the issue persists. Thank you for your patience! 😊",
});

// Helper function for AI operations
export async function executeWithCircuitBreaker<T>(
  adminId: string,
  operation: string,
  operationFn: () => Promise<T>,
  fallbackFn?: () => Promise<T>
): Promise<T> {
  return aiCircuitBreaker.execute(adminId, operation, operationFn, fallbackFn);
}