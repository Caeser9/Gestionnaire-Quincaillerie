import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Document } from 'mongoose'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'

interface InvoiceLine {
  designation: string
  quantity: number
  unitPrice: number
  discount?: number
  totalHT: number
  totalTTC: number
}

interface InvoiceDoc {
  reference: string
  customerName?: string
  lines: InvoiceLine[]
  totalHT: number
  totalTVA: number
  totalFodec?: number
  timbreFiscal?: number
  totalTTC: number
  amountPaid: number
  amountDue: number
  includeTva?: boolean
  createdAt: Date
}

interface SettingsDoc {
  companyName: string
  companyAddress?: string
  companyPhone?: string
  currency: string
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 40
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_ZONE = 160

/** Colonnes du tableau — largeurs fixes, sans chevauchement */
const TABLE = {
  designation: { x: MARGIN, w: 215 },
  qty: { x: MARGIN + 218, w: 32 },
  pu: { x: MARGIN + 253, w: 62 },
  ht: { x: MARGIN + 318, w: 72 },
  ttc: { x: MARGIN + 393, w: CONTENT_W - 393 }
} as const

const FONT_SIZE = 9
const LINE_GAP = 13
const CELL_PAD_TOP = 10
const CELL_PAD_BOTTOM = 10
const ROW_H_SINGLE = CELL_PAD_TOP + FONT_SIZE + CELL_PAD_BOTTOM
const ROW_H_MULTILINE = CELL_PAD_TOP + FONT_SIZE + LINE_GAP + FONT_SIZE + CELL_PAD_BOTTOM

/** Helvetica WinAnsi — remplace les caractères Unicode non encodables */
function sanitizePdfText(text: string): string {
  return text
    .replace(/\u2212|\u2013|\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' ')
}

function fmt(amount: number, currency: string): string {
  return `${amount.toFixed(3)} ${currency}`
}

function textWidth(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(sanitizePdfText(text), size)
}

function truncate(font: PDFFont, text: string, size: number, maxW: number): string {
  const safe = sanitizePdfText(text)
  if (textWidth(font, safe, size) <= maxW) return safe
  let s = safe
  while (s.length > 1 && textWidth(font, s + '...', size) > maxW) {
    s = s.slice(0, -1)
  }
  return s + '...'
}

function wrapLines(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const safe = sanitizePdfText(text)
  const words = safe.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (textWidth(font, candidate, size) <= maxW) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = textWidth(font, word, size) > maxW ? truncate(font, word, size, maxW) : word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines.slice(0, 2) : ['']
}

function drawLeft(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0.1, 0.1, 0.1)
) {
  page.drawText(sanitizePdfText(text), { x, y, size, font, color })
}

function drawRight(
  page: PDFPage,
  text: string,
  colX: number,
  colW: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0.1, 0.1, 0.1)
) {
  const w = textWidth(font, text, size)
  page.drawText(sanitizePdfText(text), { x: colX + colW - w, y, size, font, color })
}

function drawHLine(page: PDFPage, y: number, x1 = MARGIN, x2 = PAGE_W - MARGIN) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 0.5,
    color: rgb(0.82, 0.82, 0.82)
  })
}

type PageContext = {
  doc: PDFDocument
  page: PDFPage
  font: PDFFont
  fontBold: PDFFont
  y: number
}

function addPage(ctx: PageContext): PageContext {
  const page = ctx.doc.addPage([PAGE_W, PAGE_H])
  return { ...ctx, page, y: PAGE_H - MARGIN }
}

function ensureSpace(ctx: PageContext, needed: number, repeatHeader = false): PageContext {
  if (ctx.y - needed < MARGIN + FOOTER_ZONE) {
    const newCtx = addPage(ctx)
    return repeatHeader ? drawTableHeader(newCtx) : newCtx
  }
  return ctx
}

function drawTableHeader(ctx: PageContext) {
  const { page, fontBold, y } = ctx
  page.drawRectangle({
    x: MARGIN,
    y: y - 6,
    width: CONTENT_W,
    height: 22,
    color: rgb(0.94, 0.94, 0.94)
  })
  const hy = y
  drawLeft(page, 'Désignation', TABLE.designation.x + 4, hy, fontBold, 8)
  drawRight(page, 'Qté', TABLE.qty.x, TABLE.qty.w, hy, fontBold, 8)
  drawRight(page, 'P.U. HT', TABLE.pu.x, TABLE.pu.w, hy, fontBold, 8)
  drawRight(page, 'Total HT', TABLE.ht.x, TABLE.ht.w, hy, fontBold, 8)
  drawRight(page, 'Total TTC', TABLE.ttc.x, TABLE.ttc.w, hy, fontBold, 8)
  const headerBottom = y - 22
  drawHLine(page, headerBottom, MARGIN, PAGE_W - MARGIN)
  return { ...ctx, y: headerBottom - 4 }
}

function drawTotalsBlock(
  ctx: PageContext,
  inv: InvoiceDoc,
  cfg: SettingsDoc,
  title: string
) {
  let { page, font, fontBold, y } = ctx
  const currency = cfg.currency
  const blockW = 230
  const blockX = PAGE_W - MARGIN - blockW
  const labelX = blockX
  const valueW = 95
  const valueX = blockX + blockW - valueW

  y -= 8
  drawHLine(page, y, blockX, PAGE_W - MARGIN)
  y -= 18

  const drawTotalRow = (
    label: string,
    value: string,
    bold = false,
    valueColor = rgb(0.1, 0.1, 0.1)
  ) => {
    const f = bold ? fontBold : font
    const sz = bold ? 10 : 9
    drawLeft(page, label, labelX, y, f, sz)
    drawRight(page, value, valueX, valueW, y, f, sz, valueColor)
    y -= bold ? 18 : 15
  }

  drawTotalRow('Total HT', fmt(inv.totalHT, currency))
  if ((inv.totalFodec ?? 0) > 0) {
    drawTotalRow('FODEC (1%)', fmt(inv.totalFodec!, currency))
  }
  if (inv.includeTva) {
    drawTotalRow('TVA', fmt(inv.totalTVA, currency))
  }
  const isInvoice = title === 'FACTURE'
  const timbreAmount = isInvoice
    ? (inv.timbreFiscal ?? 0) > 0
      ? inv.timbreFiscal!
      : TIMBRE_FISCAL_AMOUNT
    : (inv.timbreFiscal ?? 0)
  if (isInvoice || timbreAmount > 0) {
    drawTotalRow('Timbre fiscal', fmt(timbreAmount, currency))
  }
  drawTotalRow('TOTAL TTC', fmt(inv.totalTTC, currency), true)

  y -= 4
  drawHLine(page, y + 10, blockX, PAGE_W - MARGIN)

  const paidLabel = title === "BON D'ACHAT" ? 'Montant payé' : 'Somme versée'
  drawTotalRow(paidLabel, fmt(inv.amountPaid, currency), false, rgb(0.1, 0.45, 0.2))

  const dueColor = inv.amountDue > 0 ? rgb(0.75, 0.15, 0.15) : rgb(0.1, 0.45, 0.2)
  drawTotalRow('Reste à payer', fmt(inv.amountDue, currency), true, dueColor)

  return { ...ctx, y }
}

export async function generateInvoicePdf(
  invoice: InvoiceDoc | Document,
  settings: SettingsDoc | Document,
  title = 'FACTURE'
): Promise<Uint8Array> {
  const inv = 'toObject' in invoice ? invoice.toObject() : invoice
  const cfg = 'toObject' in settings ? settings.toObject() : settings
  const isInvoice = title === 'FACTURE'
  const titleColor = isInvoice ? rgb(0.85, 0.35, 0.08) : rgb(0.15, 0.38, 0.72)

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  let ctx: PageContext = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    font,
    fontBold,
    y: PAGE_H - MARGIN
  }

  const { page } = ctx

  // En-tête société (gauche)
  const companyLines: string[] = [cfg.companyName]
  if (cfg.companyAddress) companyLines.push(cfg.companyAddress)
  if (cfg.companyPhone) companyLines.push(`Tél : ${cfg.companyPhone}`)

  let leftY = ctx.y
  companyLines.forEach((line, i) => {
    const f = i === 0 ? fontBold : font
    const sz = i === 0 ? 14 : 9
    const display = i === 0 ? truncate(fontBold, line, sz, 280) : truncate(font, line, sz, 280)
    drawLeft(page, display, MARGIN, leftY, f, sz, rgb(0.15, 0.15, 0.15))
    leftY -= i === 0 ? 18 : 13
  })

  // En-tête document (droite)
  const rightBlockX = PAGE_W - MARGIN - 200
  let rightY = PAGE_H - MARGIN
  drawLeft(page, title, rightBlockX, rightY, fontBold, 16, titleColor)
  rightY -= 20
  drawLeft(page, `N° ${inv.reference}`, rightBlockX, rightY, fontBold, 10)
  rightY -= 14
  drawLeft(
    page,
    `Date : ${new Date(inv.createdAt).toLocaleDateString('fr-FR')}`,
    rightBlockX,
    rightY,
    font,
    9,
    rgb(0.4, 0.4, 0.4)
  )

  ctx.y = Math.min(leftY, rightY) - 20
  drawHLine(ctx.page, ctx.y)
  ctx.y -= 22

  // Client
  drawLeft(ctx.page, 'CLIENT', MARGIN, ctx.y, fontBold, 7, rgb(0.55, 0.55, 0.55))
  ctx.y -= 13
  const clientName = inv.customerName || 'Client comptant'
  drawLeft(ctx.page, truncate(fontBold, clientName, 12, CONTENT_W), MARGIN, ctx.y, fontBold, 12)
  ctx.y -= 28

  // Tableau lignes
  ctx = drawTableHeader(ctx)

  for (const line of inv.lines) {
    const discountLabel = line.discount && line.discount > 0 ? ` (-${line.discount}%)` : ''
    const designation = line.designation + discountLabel
    const wrapped = wrapLines(ctx.font, designation, FONT_SIZE, TABLE.designation.w - 8)
    const isMultiline = wrapped.length > 1
    const rowH = isMultiline ? ROW_H_MULTILINE : ROW_H_SINGLE

    ctx = ensureSpace(ctx, rowH + 2, true)

    const textY = ctx.y - CELL_PAD_TOP
    wrapped.forEach((ln, i) => {
      drawLeft(ctx.page, ln, TABLE.designation.x + 4, textY - i * LINE_GAP, ctx.font, FONT_SIZE)
    })

    const numsY = isMultiline ? textY - LINE_GAP / 2 : textY
    drawRight(ctx.page, String(line.quantity), TABLE.qty.x, TABLE.qty.w, numsY, ctx.font, FONT_SIZE)
    drawRight(ctx.page, line.unitPrice.toFixed(3), TABLE.pu.x, TABLE.pu.w, numsY, ctx.font, FONT_SIZE)
    drawRight(ctx.page, line.totalHT.toFixed(3), TABLE.ht.x, TABLE.ht.w, numsY, ctx.font, FONT_SIZE)
    drawRight(ctx.page, line.totalTTC.toFixed(3), TABLE.ttc.x, TABLE.ttc.w, numsY, ctx.font, FONT_SIZE)

    ctx.y -= rowH
    drawHLine(ctx.page, ctx.y, MARGIN, PAGE_W - MARGIN)
  }

  ctx = ensureSpace(ctx, FOOTER_ZONE)
  ctx = drawTotalsBlock(ctx, inv, cfg, title)

  // Pied de page
  const footerY = MARGIN - 10
  drawLeft(
    ctx.page,
    `${cfg.companyName} — ${title} ${inv.reference}`,
    MARGIN,
    footerY,
    ctx.font,
    7,
    rgb(0.6, 0.6, 0.6)
  )

  return doc.save()
}

export async function generatePurchaseSlipPdf(
  slip: InvoiceDoc | Document,
  settings: SettingsDoc | Document
): Promise<Uint8Array> {
  return generateInvoicePdf(slip, settings, "BON D'ACHAT")
}

export function generatePurchaseSlipEscPos(
  slip: InvoiceDoc | Document,
  settings: SettingsDoc | Document
): Buffer {
  const s = 'toObject' in slip ? slip.toObject() : slip
  const cfg = 'toObject' in settings ? settings.toObject() : settings

  const ESC = '\x1B'
  const GS = '\x1D'
  const lines: string[] = []

  lines.push(`${ESC}@`)
  lines.push(`${ESC}a\x01`)
  lines.push(`${ESC}!\x18${cfg.companyName}\n`)
  lines.push(`${ESC}!\x00`)
  if (cfg.companyAddress) lines.push(`${cfg.companyAddress}\n`)
  if (cfg.companyPhone) lines.push(`Tel: ${cfg.companyPhone}\n`)
  lines.push('--------------------------------\n')
  lines.push(`${ESC}!\x10BON D'ACHAT\n`)
  lines.push(`${ESC}!\x00`)
  lines.push(`N°: ${s.reference}\n`)
  lines.push(`Date: ${new Date(s.createdAt).toLocaleString('fr-FR')}\n`)
  lines.push(`Client: ${s.customerName || '—'}\n`)
  lines.push('--------------------------------\n')

  for (const line of s.lines) {
    const discountLabel = line.discount && line.discount > 0 ? ` -${line.discount}%` : ''
    lines.push(`${line.designation.substring(0, 22)}${discountLabel}\n`)
    lines.push(` ${line.quantity} x ${line.unitPrice.toFixed(3)} = ${line.totalTTC.toFixed(3)}\n`)
  }

  lines.push('--------------------------------\n')
  lines.push(`HT: ${s.totalHT.toFixed(3)} ${cfg.currency}\n`)
  if ((s.totalFodec ?? 0) > 0) {
    lines.push(`FODEC: ${s.totalFodec!.toFixed(3)} ${cfg.currency}\n`)
  }
  if (s.includeTva) {
    lines.push(`TVA: ${s.totalTVA.toFixed(3)} ${cfg.currency}\n`)
  }
  if ((s.timbreFiscal ?? 0) > 0) {
    lines.push(`Timbre: ${s.timbreFiscal!.toFixed(3)} ${cfg.currency}\n`)
  }
  lines.push(`TOTAL: ${s.totalTTC.toFixed(3)} ${cfg.currency}\n`)
  lines.push(`PAYE: ${s.amountPaid.toFixed(3)} ${cfg.currency}\n`)
  lines.push(`${ESC}!\x08RESTE: ${s.amountDue.toFixed(3)} ${cfg.currency}\n`)
  lines.push(`${ESC}!\x00`)
  lines.push('\n\n\n')
  lines.push(`${GS}V\x00`)

  return Buffer.from(lines.join(''), 'binary')
}

export function generateReceiptEscPos(
  invoice: InvoiceDoc | Document,
  settings: SettingsDoc | Document
): Buffer {
  const inv = 'toObject' in invoice ? invoice.toObject() : invoice
  const cfg = 'toObject' in settings ? settings.toObject() : settings

  const ESC = '\x1B'
  const GS = '\x1D'
  const lines: string[] = []

  lines.push(`${ESC}@`)
  lines.push(`${ESC}a\x01`)
  lines.push(`${ESC}!\x18${cfg.companyName}\n`)
  lines.push(`${ESC}!\x00`)
  if (cfg.companyAddress) lines.push(`${cfg.companyAddress}\n`)
  if (cfg.companyPhone) lines.push(`Tel: ${cfg.companyPhone}\n`)
  lines.push('--------------------------------\n')
  lines.push(`Facture: ${inv.reference}\n`)
  lines.push(`Date: ${new Date(inv.createdAt).toLocaleString('fr-FR')}\n`)
  lines.push(`Client: ${inv.customerName || 'Comptant'}\n`)
  lines.push('--------------------------------\n')
  lines.push('Designation    Qte  PU    TTC\n')
  lines.push('--------------------------------\n')

  for (const line of inv.lines) {
    const discountLabel = line.discount && line.discount > 0 ? ` -${line.discount}%` : ''
    lines.push(`${line.designation.substring(0, 20)}${discountLabel}\n`)
    lines.push(` ${line.quantity} x ${line.unitPrice.toFixed(3)} = ${line.totalTTC.toFixed(3)}\n`)
  }

  lines.push('--------------------------------\n')
  lines.push(`HT: ${inv.totalHT.toFixed(3)} ${cfg.currency}\n`)
  if ((inv.totalFodec ?? 0) > 0) {
    lines.push(`FODEC: ${inv.totalFodec!.toFixed(3)} ${cfg.currency}\n`)
  }
  if (inv.includeTva) {
    lines.push(`TVA: ${inv.totalTVA.toFixed(3)} ${cfg.currency}\n`)
  }
  const timbreAmount =
    (inv.timbreFiscal ?? 0) > 0 ? inv.timbreFiscal! : TIMBRE_FISCAL_AMOUNT
  lines.push(`Timbre: ${timbreAmount.toFixed(3)} ${cfg.currency}\n`)
  lines.push(`TOTAL: ${inv.totalTTC.toFixed(3)} ${cfg.currency}\n`)
  lines.push(`Verse: ${inv.amountPaid.toFixed(3)} ${cfg.currency}\n`)
  lines.push(`Reste: ${inv.amountDue.toFixed(3)} ${cfg.currency}\n`)
  lines.push('\n\n\n')
  lines.push(`${GS}V\x00`)

  return Buffer.from(lines.join(''), 'binary')
}
