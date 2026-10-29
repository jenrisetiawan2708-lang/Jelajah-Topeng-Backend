import type { RequestHandler } from "express";

// Augmentasi response (PPT 6): format seragam untuk sukses maupun error.
//   sukses: { success: true,  message, data, requestId }
//   error : { success: false, message, errors?, requestId }
export const responseEnvelope: RequestHandler = (req, res, next) => {
  res.success = (data, message = "OK", status = 200) =>
    res.status(status).json({ success: true, message, data, requestId: req.id });

  res.fail = (message, status = 400, errors) =>
    res.status(status).json({
      success: false,
      message,
      ...(errors ? { errors } : {}),
      requestId: req.id,
    });

  next();
};