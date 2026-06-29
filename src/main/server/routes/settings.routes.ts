import { Router } from 'express'
import { Settings, AuditLog } from '../../db/models'
import { attachActor, getActorId } from '../middleware/context'
import { sendSuccess, handleZodError, asyncHandler } from '../middleware/response'
import { settingsSchema } from '@shared/validation/schemas'
import { logAudit } from '../../services/audit.service'
import { DEFAULT_MONGO_URI } from '@shared/constants'

const router = Router()
router.use(attachActor)

router.get('/settings', asyncHandler(async (_req, res) => {
  let settings = await Settings.findOne()
  if (!settings) {
    settings = await Settings.create({})
  }
  sendSuccess(res, settings)
}))

router.put('/settings', asyncHandler(async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const old = await Settings.findOne()
  const updateData = { ...parsed.data }
  if (!updateData.mongoUri) {
    updateData.mongoUri = old?.mongoUri ?? DEFAULT_MONGO_URI
  }
  const settings = await Settings.findOneAndUpdate({}, updateData, { new: true, upsert: true })

  await logAudit({
    userId: getActorId(req),
    username: 'system',
    action: 'update',
    targetCollection: 'settings',
    documentId: settings!._id.toString(),
    oldValue: old?.toObject(),
    newValue: settings!.toObject()
  })

  sendSuccess(res, settings)
}))

router.get('/audit-logs', asyncHandler(async (req, res) => {
  const { page = '1', limit = '50' } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)

  const [data, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    AuditLog.countDocuments()
  ])

  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

export default router
