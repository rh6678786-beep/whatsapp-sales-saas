import { Request, Response, NextFunction } from "express";
import { getCorrelationId } from "./correlationId.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const cid = getCorrelationId(req).slice(0, 8);
    const color =
      statusCode >= 500 ? "\x1b[31m" :
      statusCode >= 400 ? "\x1b[33m" :
      statusCode >= 300 ? "\x1b[36m" :
      "\x1b[32m";
    console.log(`${color}[${cid}] ${method}${"\x1b[0m"} ${originalUrl} ${color}${statusCode}${"\x1b[0m"} ${duration}ms`);
  });

  next();
}
