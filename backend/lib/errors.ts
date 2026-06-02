export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTHENTICATION_REQUIRED");
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = "Invalid or expired token") {
    super(message, 401, "INVALID_TOKEN");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;

  constructor(message = "Validation failed", fields?: Record<string, string>) {
    super(message, 400, "VALIDATION_ERROR");
    this.fields = fields;
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
  }
}

export class TenantIsolationError extends AppError {
  constructor(message = "Cross-tenant access denied") {
    super(message, 403, "TENANT_ISOLATION_ERROR");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}

export class PaymentError extends AppError {
  constructor(message = "Payment processing error") {
    super(message, 402, "PAYMENT_ERROR");
  }
}

export class AIError extends AppError {
  constructor(message = "AI service error") {
    super(message, 503, "AI_SERVICE_ERROR");
  }
}
