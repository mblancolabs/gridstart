import { describe, it, expect } from "vitest";
import { AppError, BadRequestError, NotFoundError, ExternalServiceError, ValidationError } from "./errors";

describe("AppError", () => {
  it("creates error with default values", () => {
    const err = new AppError("something went wrong");
    expect(err.message).toBe("something went wrong");
    expect(err.status).toBe(500);
    expect(err.exposeMessage).toBe(false);
    expect(err).toBeInstanceOf(Error);
  });

  it("creates error with custom status and exposeMessage", () => {
    const err = new AppError("custom error", 418, true);
    expect(err.status).toBe(418);
    expect(err.exposeMessage).toBe(true);
  });
});

describe("BadRequestError", () => {
  it("returns 400 with default message", () => {
    const err = new BadRequestError();
    expect(err.status).toBe(400);
    expect(err.exposeMessage).toBe(true);
    expect(err.message).toBe("Bad Request");
  });

  it("returns 400 with custom message", () => {
    const err = new BadRequestError("Invalid series IDs");
    expect(err.message).toBe("Invalid series IDs");
  });
});

describe("NotFoundError", () => {
  it("returns 404 with default message", () => {
    const err = new NotFoundError();
    expect(err.status).toBe(404);
    expect(err.exposeMessage).toBe(true);
    expect(err.message).toBe("Not Found");
  });

  it("returns 404 with custom message", () => {
    const err = new NotFoundError("Series not found");
    expect(err.message).toBe("Series not found");
  });
});

describe("ExternalServiceError", () => {
  it("returns 502 without exposing message", () => {
    const err = new ExternalServiceError();
    expect(err.status).toBe(502);
    expect(err.exposeMessage).toBe(false);
    expect(err.message).toBe("External Service Failure");
  });
});

describe("ValidationError", () => {
  it("extends BadRequestError with 400", () => {
    const err = new ValidationError();
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(400);
    expect(err.exposeMessage).toBe(true);
    expect(err.message).toBe("Invalid request");
  });
});
