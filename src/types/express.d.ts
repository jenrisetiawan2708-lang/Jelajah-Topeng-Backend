import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    id: string;
  }
  interface Response {
    success: <T>(data: T, message?: string, status?: number) => Response;
    fail: (message: string, status?: number, errors?: unknown) => Response;
  }
}