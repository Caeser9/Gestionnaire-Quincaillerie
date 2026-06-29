import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { ZodError } from 'zod'

type AsyncRouteHandler = (req: Request, res: Response) => Promise<void>

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data })
}

export function sendError(
  res: Response,
  message: string,
  status = 400,
  errors?: Record<string, string[]>
): void {
  res.status(status).json({ success: false, error: { message, errors } })
}

export function handleZodError(res: Response, error: ZodError): void {
  const errors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (!errors[path]) errors[path] = []
    errors[path].push(issue.message)
  }
  sendError(res, 'Données invalides', 400, errors)
}

export function asyncHandler(fn: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next)
  }
}
