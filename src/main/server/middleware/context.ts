import mongoose from 'mongoose'
import type { NextFunction, Request, Response } from 'express'

export const SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000001')

export interface AppRequest extends Request {
  actorId?: string
}

export function attachActor(req: AppRequest, _res: Response, next: NextFunction): void {
  req.actorId = SYSTEM_USER_ID.toString()
  next()
}

export function getActorId(req: AppRequest): string {
  return req.actorId || SYSTEM_USER_ID.toString()
}
