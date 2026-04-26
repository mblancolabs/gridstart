export class AppError extends Error {
  public readonly status: number;
  public readonly exposeMessage: boolean;

  constructor(message: string, status = 500, exposeMessage = false) {
    super(message);
    this.status = status;
    this.exposeMessage = exposeMessage;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad Request") {
    super(message, 400, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not Found") {
    super(message, 404, true);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = "External Service Failure") {
    super(message, 502, false);
  }
}

export class ValidationError extends BadRequestError {
  constructor(message = "Invalid request") {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
