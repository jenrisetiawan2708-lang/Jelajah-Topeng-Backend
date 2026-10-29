// Error yang sengaja dilempar (400/401/403/404/409...). Ditangkap error handler global.
export class AppError extends Error {
  status: number;
  errors?: unknown;

  constructor(status: number, message: string, errors?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.errors = errors;
  }
}