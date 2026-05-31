import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { errorHandler } from "./errorHandler";
import { BadRequestError } from "./errors";

function createMockResponse(headersSent = false) {
  let statusCode = 200;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jsonBody: any = null;
  return {
    headersSent,
    status(code: number) {
      statusCode = code;
      return this;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json(body: any) {
      jsonBody = body;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return jsonBody;
    },
  };
}

describe("errorHandler", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns generic production response without stack for unexpected errors", () => {
    process.env.NODE_ENV = "production";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = { requestId: "request-123" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = createMockResponse();
    const next = () => {
      throw new Error("next should not be called");
    };

    errorHandler(new Error("secret error"), req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Internal Server Error",
      }),
    );
    expect(res.body.errorId).toEqual(expect.any(String));
    expect(res.body.stack).toBeUndefined();
  });

  it("returns exposed client error details in development", () => {
    process.env.NODE_ENV = "development";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = { requestId: "request-456" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = createMockResponse();
    const next = () => {
      throw new Error("next should not be called");
    };
    const error = new BadRequestError("Invalid series IDs");

    errorHandler(error, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Invalid series IDs",
      }),
    );
    expect(res.body.errorId).toBeUndefined();
    expect(res.body.stack).toEqual(expect.any(String));
  });

  it("handles non-AppError client errors in else branch", () => {
    process.env.NODE_ENV = "development";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = { requestId: "req-789" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = createMockResponse();
    const next = () => {
      throw new Error("next should not be called");
    };

    const error = new Error("Not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).status = 404;

    errorHandler(error, req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Not found");
  });

  it("passes to next middleware when headers already sent", () => {
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = { requestId: "req-101" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = createMockResponse(true);

    errorHandler(new Error("late error"), req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
