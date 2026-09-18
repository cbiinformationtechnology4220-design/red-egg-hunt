const PUBLIC_MESSAGES = Object.freeze({
  INVALID_CONFIGURATION: 'The promotion service is not configured correctly.',
  VALIDATION_ERROR: 'Review the highlighted fields and try again.',
  METHOD_NOT_ALLOWED: 'This request method is not supported.',
  FORBIDDEN: 'This action is not permitted.',
  UNAUTHORIZED: 'Staff access is required.',
  RATE_LIMITED: 'Too many attempts. Try again later.',
  CAMPAIGN_LOCKED: 'The Red Egg Hunt is not open yet.',
  CAMPAIGN_ENDED: 'The Red Egg Hunt is closed for new submissions.',
  INVALID_CODE: 'That printed code is not valid.',
  ALREADY_SUBMITTED: 'This printed code has already been submitted.',
  CODE_NOT_SUBMITTED: 'This code has not been submitted yet.',
  ALREADY_CLAIMED: 'This winning code has already been claimed.',
  IDEMPOTENCY_CONFLICT: 'This retry cannot be matched safely. Submit the current form again.',
  DATABASE_ERROR: 'The promotion service is temporarily unavailable.',
  INTERNAL_ERROR: 'The promotion service is temporarily unavailable.',
});

export class AppError extends Error {
  constructor(code, message, { status = 400, details = null, cause = undefined } = {}) {
    super(message || PUBLIC_MESSAGES[code] || PUBLIC_MESSAGES.INTERNAL_ERROR, { cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function publicError(error) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: PUBLIC_MESSAGES[error.code] || PUBLIC_MESSAGES.INTERNAL_ERROR,
        },
      },
    };
  }

  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: PUBLIC_MESSAGES.INTERNAL_ERROR } },
  };
}

export { PUBLIC_MESSAGES };
