import mongoose from 'mongoose'
import { AuditLog } from '../db/models'
import type { AuditAction } from '@shared/types'

export interface AuditParams {
  userId: string
  username: string
  action: AuditAction
  targetCollection: string
  documentId: string
  oldValue?: unknown
  newValue?: unknown
}

export async function logAudit(params: AuditParams): Promise<void> {
  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(params.userId),
    username: params.username,
    action: params.action,
    targetCollection: params.targetCollection,
    documentId: params.documentId,
    oldValue: params.oldValue,
    newValue: params.newValue
  })
}
