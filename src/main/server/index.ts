import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { DEFAULT_PORT } from '@shared/constants'
import { sendError } from './middleware/response'
import pdfRoutes from './routes/pdf.routes'
import productsRoutes from './routes/products.routes'
import customersRoutes from './routes/customers.routes'
import suppliersRoutes from './routes/suppliers.routes'
import salesRoutes from './routes/sales.routes'
import inventoryRoutes from './routes/inventory.routes'
import reportsRoutes from './routes/reports.routes'
import settingsRoutes from './routes/settings.routes'
import financeRoutes from './routes/finance.routes'

let serverPort = DEFAULT_PORT

export function createApp(): Express {
  const app = express()

  app.use(cors({ origin: true }))
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', port: serverPort } })
  })

  app.get('/api', (_req, res) => {
    res.json({ success: true, data: { name: 'Gestionnaire Quincaillerie API', version: '1.0.0' } })
  })

  app.use('/api', pdfRoutes)
  app.use('/api', productsRoutes)
  app.use('/api', customersRoutes)
  app.use('/api', suppliersRoutes)
  app.use('/api', salesRoutes)
  app.use('/api', inventoryRoutes)
  app.use('/api', reportsRoutes)
  app.use('/api', settingsRoutes)
  app.use('/api', financeRoutes)

  app.use((req: Request, res: Response) => {
    console.warn(`[API 404] ${req.method} ${req.originalUrl}`)
    sendError(res, `Route introuvable : ${req.method} ${req.path}`, 404)
  })

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Error]', err)
    sendError(res, err.message || 'Erreur serveur', 500)
  })

  return app
}

export async function startServer(port: number = DEFAULT_PORT): Promise<number> {
  const app = createApp()

  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      serverPort = port
      console.log(`[API] Server running on http://127.0.0.1:${port}`)
      resolve(port)
    })
    server.on('error', reject)
  })
}

export function getServerPort(): number {
  return serverPort
}
