import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidStatusTransitionException extends HttpException {
  constructor(from: string, to: string) {
    super(
      {
        message_key: 'deal.invalid_status_transition',
        message: `Cannot transition from ${from} to ${to}`,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class MissingFieldsException extends HttpException {
  constructor(fields: string[]) {
    super(
      {
        message_key: 'deal.missing_fields',
        message: 'Required fields are missing',
        errors: fields.map((f) => ({
          field: f,
          message_key: `validation.${f}.required`,
          constraints: { required: 'This field is required' },
        })),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class FieldsLockedException extends HttpException {
  constructor() {
    super(
      {
        message_key: 'deal.fields_locked_after_payment',
        message: 'These fields cannot be modified after payment',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class PaymentNotReadyException extends HttpException {
  constructor() {
    super(
      {
        message_key: 'payment.not_ready_for_payment',
        message: 'Deal is not ready for payment',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PaymentAlreadyVerifiedException extends HttpException {
  constructor() {
    super(
      {
        message_key: 'payment.already_verified',
        message: 'Payment has already been verified',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidTokenException extends HttpException {
  constructor() {
    super(
      {
        message_key: 'auth.invalid_token',
        message: 'Invalid access token',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class InviteExpiredException extends HttpException {
  constructor() {
    super(
      {
        message_key: 'invite.invalid_or_expired',
        message: 'Invite link is invalid or expired',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InvalidFileTypeException extends HttpException {
  constructor() {
    super(
      {
        message_key: 'file.invalid_type',
        message: 'File type not allowed',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class FileTooLargeException extends HttpException {
  constructor() {
    super(
      {
        message_key: 'file.too_large',
        message: 'File size exceeds maximum allowed',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
