export type PublicErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    correlationId: string;
  };
};

export class FcsError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly correlationId: string;

  constructor(
    code: string,
    message: string,
    status: number,
    retryable = false,
    correlationId = crypto.randomUUID(),
  ) {
    super(message);
    this.name = 'FcsError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.correlationId = correlationId;
  }

  toEnvelope(): PublicErrorEnvelope {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        correlationId: this.correlationId,
      },
    };
  }
}

export function unavailableVariant(): FcsError {
  return new FcsError(
    'VARIANT_NOT_FOUND',
    'The requested variant is unavailable.',
    404,
  );
}

export function normalizePublicError(error: unknown): FcsError {
  if (error instanceof FcsError) return error;
  if (error instanceof Error && error.message.includes('FCS_RATE_LIMITED')) {
    return new FcsError(
      'RATE_LIMITED',
      'This workspace is temporarily at its operation limit. Try again later.',
      429,
      true,
    );
  }
  return new FcsError(
    'INTERNAL_ERROR',
    'The request could not be completed.',
    500,
    true,
  );
}

export function rethrowRateLimitError(error: unknown): void {
  const normalized = normalizePublicError(error);
  if (normalized.code === 'RATE_LIMITED') throw normalized;
}
