import type { NextFunction, Request, RequestHandler, Response } from "express";

// try/catch terpusat (PPT 7): error dari async function otomatis diteruskan
// ke error handler global lewat next(error), tanpa try/catch berulang di tiap controller.
export const asyncHandler =
  (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };