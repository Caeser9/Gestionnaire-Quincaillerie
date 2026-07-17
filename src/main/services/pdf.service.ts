import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Document } from 'mongoose'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'

interface InvoiceLine {
  reference?: string
  designation: string
  quantity: number
  unitPrice: number
  tva?: number
  discount?: number
  totalHT: number
  totalTTC: number
}

interface InvoiceDoc {
  reference: string
  customerName?: string
  customerAddress?: string
  customerCode?: string
  customerTvaCode?: string
  vehicleRegistration?: string
  customerMatricule?: string 
  customerId?: string
  lines: InvoiceLine[]
  totalHT: number
  totalTVA: number
  timbreFiscal?: number
  totalTTC: number
  amountPaid: number
  amountDue: number
  bcNumber?: string
  blNumber?: string
  pieceNumber?: string
  representative?: string
  deliveryPerson?: string
  deliveryDriverName?: string
  deliveryDriverCin?: string
  deliveryVehiclePlate?: string
  validUntil?: Date | string
  includeTva?: boolean
  createdAt: Date
}

interface SettingsDoc {
  companyName: string
  companyAddress?: string
  companyPhone?: string
  companyFax?: string
  companyMatriculeFiscal?: string
  companyTvaCode?: string
  companyRC?: string
  defaultTva?: number
  currency: string
}

const MM_TO_PT = 72 / 25.4
const PAGE_WIDTH = 210 * MM_TO_PT
const PAGE_HEIGHT = 297 * MM_TO_PT
const MARGIN = 12 * MM_TO_PT
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = 10 * MM_TO_PT
const FOOTER_HEIGHT = 20 * MM_TO_PT
const FOOTER_BOX_GAP = 8
const WORDS_SECTION_HEIGHT = 14 * MM_TO_PT
const TOTALS_BOX_HEIGHT = 46 * MM_TO_PT
const TOTALS_BOX_WIDTH = 200
const TAX_BOX_WIDTH = 240
const TAX_BOX_HEIGHT = 14 * MM_TO_PT
const HEADER_GAP = 8
const SUMMARY_GAP = 6

const COLORS = {
  black: rgb(0, 0, 0),
  darkGray: rgb(0.15, 0.15, 0.15),
  mediumGray: rgb(0.35, 0.35, 0.35),
  lightGray: rgb(0.94, 0.94, 0.94),
  invoiceBlue: rgb(0.08, 0.18, 0.55)
}

const FONT_SIZES = {
  title: 32,
  meta: 10,
  label: 9,
  value: 8.5,
  tableHeader: 7.5,
  tableRow: 8,
  totalLabel: 8.5,
  totalValue: 9,
  netValue: 11,
  footerLabel: 8,
  boxLabel: 7.5,
  boxValue: 11,
  boxCompanyName: 12
}

const TABLE_COLUMN_WIDTHS = {
  number: 22,
  reference: 68,
  designation: 168,
  qte: 32,
  puht: 52,
  mht: 52,
  rm: 26,
  tva: 28
} as const

const TABLE_FIXED_WIDTH = Object.values(TABLE_COLUMN_WIDTHS).reduce((sum, value) => sum + value, 0)
const TABLE_NET_WIDTH = Math.max(CONTENT_WIDTH - TABLE_FIXED_WIDTH, 48)

const TABLE_COLUMNS = {
  number: { x: MARGIN, w: TABLE_COLUMN_WIDTHS.number },
  reference: { x: MARGIN + TABLE_COLUMN_WIDTHS.number, w: TABLE_COLUMN_WIDTHS.reference },
  designation: { x: MARGIN + TABLE_COLUMN_WIDTHS.number + TABLE_COLUMN_WIDTHS.reference, w: TABLE_COLUMN_WIDTHS.designation },
  qte: { x: MARGIN + TABLE_COLUMN_WIDTHS.number + TABLE_COLUMN_WIDTHS.reference + TABLE_COLUMN_WIDTHS.designation, w: TABLE_COLUMN_WIDTHS.qte },
  puht: { x: MARGIN + TABLE_COLUMN_WIDTHS.number + TABLE_COLUMN_WIDTHS.reference + TABLE_COLUMN_WIDTHS.designation + TABLE_COLUMN_WIDTHS.qte, w: TABLE_COLUMN_WIDTHS.puht },
  mht: { x: MARGIN + TABLE_COLUMN_WIDTHS.number + TABLE_COLUMN_WIDTHS.reference + TABLE_COLUMN_WIDTHS.designation + TABLE_COLUMN_WIDTHS.qte + TABLE_COLUMN_WIDTHS.puht, w: TABLE_COLUMN_WIDTHS.mht },
  rm: { x: MARGIN + TABLE_COLUMN_WIDTHS.number + TABLE_COLUMN_WIDTHS.reference + TABLE_COLUMN_WIDTHS.designation + TABLE_COLUMN_WIDTHS.qte + TABLE_COLUMN_WIDTHS.puht + TABLE_COLUMN_WIDTHS.mht, w: TABLE_COLUMN_WIDTHS.rm },
  tva: { x: MARGIN + TABLE_COLUMN_WIDTHS.number + TABLE_COLUMN_WIDTHS.reference + TABLE_COLUMN_WIDTHS.designation + TABLE_COLUMN_WIDTHS.qte + TABLE_COLUMN_WIDTHS.puht + TABLE_COLUMN_WIDTHS.mht + TABLE_COLUMN_WIDTHS.rm, w: TABLE_COLUMN_WIDTHS.tva },
  net: {
    x:
      MARGIN +
      TABLE_COLUMN_WIDTHS.number +
      TABLE_COLUMN_WIDTHS.reference +
      TABLE_COLUMN_WIDTHS.designation +
      TABLE_COLUMN_WIDTHS.qte +
      TABLE_COLUMN_WIDTHS.puht +
      TABLE_COLUMN_WIDTHS.mht +
      TABLE_COLUMN_WIDTHS.rm +
      TABLE_COLUMN_WIDTHS.tva,
    w: TABLE_NET_WIDTH
  }
} as const

const TABLE_ROW_HEIGHT = 18
const TABLE_HEADER_HEIGHT = 22
const FOOTER_FONT_SIZE = FONT_SIZES.footerLabel

type PageContext = {
  doc: PDFDocument
  page: PDFPage
  font: PDFFont
  fontBold: PDFFont
  fontSerif?: PDFFont
  y: number
}

type SummaryLayout = {
  footerBottom: number
  wordsBottom: number
  wordsTop: number
  summaryBottom: number
  summaryTop: number
  tableBottom: number
}

function computeSummaryLayout(): SummaryLayout {
  const footerBottom = FOOTER_Y
  const wordsBottom = footerBottom + FOOTER_HEIGHT + SUMMARY_GAP
  const wordsTop = wordsBottom + WORDS_SECTION_HEIGHT
  const summaryBottom = wordsTop + SUMMARY_GAP
  const summaryTop = summaryBottom + TOTALS_BOX_HEIGHT
  const tableBottom = summaryTop + SUMMARY_GAP
  return { footerBottom, wordsBottom, wordsTop, summaryBottom, summaryTop, tableBottom }
}

function sanitizePdfText(text: string): string {
  return text
    .replace(/\u2212|\u2013|\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' ')
}

function fmt3(amount: number | undefined): string {
  return (amount ?? 0).toFixed(3)
}

function fmt2(amount: number | undefined): string {
  return (amount ?? 0).toFixed(2).replace('.', ',')
}

function fmtQty(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3)
}

function textWidth(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(sanitizePdfText(text), size)
}

function drawLeft(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = COLORS.black
) {
  page.drawText(sanitizePdfText(text), { x, y, size, font, color })
}

function drawRight(
  page: PDFPage,
  text: string,
  x: number,
  width: number,
  y: number,
  font: PDFFont,
  size: number,
  color = COLORS.black
) {
  const w = textWidth(font, text, size)
  page.drawText(sanitizePdfText(text), { x: x + width - w, y, size, font, color })
}

function drawCenter(
  page: PDFPage,
  text: string,
  x: number,
  width: number,
  y: number,
  font: PDFFont,
  size: number,
  color = COLORS.black
) {
  const w = textWidth(font, text, size)
  page.drawText(sanitizePdfText(text), { x: x + (width - w) / 2, y, size, font, color })
}

function drawLine(page: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness = 0.5, color = COLORS.black) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color })
}

function drawBox(page: PDFPage, x: number, y: number, width: number, height: number, borderColor = COLORS.black, borderWidth = 0.7) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor,
    borderWidth,
    color: rgb(1, 1, 1)
  })
}

function drawUnderline(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number) {
  drawLeft(page, text, x, y, font, size)
  const width = textWidth(font, text, size)
  drawLine(page, x, y - 2, x + width, y - 2, 0.6, COLORS.black)
}

function resolveDeliveryInfo(inv: InvoiceDoc) {
  const driverName = inv.deliveryDriverName || inv.deliveryPerson || inv.representative || ''
  const driverCin = inv.deliveryDriverCin || ''
  const plate = inv.deliveryVehiclePlate || inv.vehicleRegistration || ''
  return { driverName, driverCin, plate }
}

function drawBoxLabelValue(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  value: string,
  font: PDFFont,
  fontBold: PDFFont,
  maxWidth: number
): number {
  const labelText = `${label.toUpperCase()} :`
  drawLeft(page, labelText, x, y, font, FONT_SIZES.boxLabel, COLORS.mediumGray)

  const labelWidth = textWidth(font, `${labelText} `, FONT_SIZES.boxLabel)
  const valueText = sanitizePdfText((value || '—').toUpperCase())
  const valueLines = wrapLines(fontBold, valueText, FONT_SIZES.boxValue, Math.max(maxWidth - labelWidth - 4, 40))

  drawLeft(page, valueLines[0], x + labelWidth + 2, y - 0.5, fontBold, FONT_SIZES.boxValue, COLORS.black)
  if (valueLines[1]) {
    drawLeft(page, valueLines[1], x, y - 13, fontBold, FONT_SIZES.boxValue, COLORS.black)
    return y - 26
  }

  return y - 15
}

type PartyField = { label: string; value: string }

function buildSellerFields(cfg: SettingsDoc): PartyField[] {
  const fields: PartyField[] = []
  if (cfg.companyAddress?.trim()) fields.push({ label: 'Adresse', value: cfg.companyAddress.trim() })
  if (cfg.companyPhone?.trim()) fields.push({ label: 'Téléphone', value: cfg.companyPhone.trim() })
  if (cfg.companyFax?.trim()) fields.push({ label: 'Fax', value: cfg.companyFax.trim() })  
  if (cfg.companyRC?.trim()) fields.push({ label: 'Registre de commerce', value: cfg.companyRC.trim() })
  if (cfg.companyTvaCode?.trim()) fields.push({ label: 'Code TVA', value: cfg.companyTvaCode.trim() })
  return fields
}

function buildCustomerFields(inv: InvoiceDoc): PartyField[] {
  const fields: PartyField[] = []
  if (inv.customerCode?.trim()) fields.push({ label: 'Code', value: inv.customerCode.trim() })
  fields.push({ label: 'Client', value: inv.customerName || 'Client comptant' })
  if (inv.customerAddress?.trim()) fields.push({ label: 'Adresse', value: inv.customerAddress.trim() })
  if (inv.customerMatricule?.trim()) {
    fields.push({ label: 'Mat. fiscale / Code TVA', value: inv.customerMatricule.trim() })
  }
  if (inv.customerTvaCode?.trim()) {
    fields.push({ label: 'Code TVA', value: inv.customerTvaCode.trim() })
  }
  return fields
}

function estimatePartyBoxHeight(fieldCount: number): number {
  return Math.max(88, 36 + fieldCount * 16)
}

function drawPartyBox(
  page: PDFPage,
  x: number,
  topY: number,
  width: number,
  height: number,
  sectionTitle: string,
  mainName: string,
  fields: PartyField[],
  font: PDFFont,
  fontBold: PDFFont
) {
  const innerPad = 6
  const innerWidth = width - innerPad * 2

  drawBox(page, x, topY - height, width, height)
  drawLeft(page, sectionTitle, x + innerPad, topY - 12, fontBold, FONT_SIZES.boxLabel, COLORS.mediumGray)
  drawLeft(
    page,
    (mainName || '—').toUpperCase(),
    x + innerPad,
    topY - 26,
    fontBold,
    FONT_SIZES.boxCompanyName,
    COLORS.black
  )

  let y = topY - 40
  for (const field of fields) {
    y = drawBoxLabelValue(page, x + innerPad, y, field.label, field.value, font, fontBold, innerWidth)
  }
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
      continue
    }

    if (current) {
      lines.push(current)
    }

    current = textWidth(font, word, size) > maxW ? truncate(font, word, size, maxW) : word
  }

  if (current) lines.push(current)
  return lines.length ? lines.slice(0, 2) : ['']
}

function truncate(font: PDFFont, text: string, size: number, maxW: number): string {
  const safe = sanitizePdfText(text)
  if (textWidth(font, safe, size) <= maxW) return safe

  let truncated = safe
  while (truncated.length > 1 && textWidth(font, `${truncated}...`, size) > maxW) {
    truncated = truncated.slice(0, -1)
  }

  return `${truncated}...`
}

function formatDate(value?: Date | string): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR')
}

function formatTime(value?: Date | string): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const SMALL_NUMBERS = [
  'zero',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize'
]

function numberToFrenchWords(value: number): string {
  if (value < 17) return SMALL_NUMBERS[value]
  if (value < 20) return `dix-${SMALL_NUMBERS[value - 10]}`
  if (value < 70) {
    const tensNames: Record<number, string> = {
      20: 'vingt',
      30: 'trente',
      40: 'quarante',
      50: 'cinquante',
      60: 'soixante'
    }
    const ten = Math.floor(value / 10) * 10
    const unit = value % 10
    if (unit === 0) return tensNames[ten]
    if (unit === 1) return `${tensNames[ten]} et un`
    return `${tensNames[ten]}-${SMALL_NUMBERS[unit]}`
  }
  if (value < 80) return `soixante-${numberToFrenchWords(value - 60)}`
  if (value < 100) {
    if (value === 80) return 'quatre-vingts'
    return `quatre-vingt-${numberToFrenchWords(value - 80)}`
  }
  if (value < 1000) {
    const hundred = Math.floor(value / 100)
    const rest = value % 100
    const prefix = hundred === 1 ? 'cent' : `${SMALL_NUMBERS[hundred]} cent`
    return rest === 0 ? prefix : `${prefix} ${numberToFrenchWords(rest)}`
  }
  const thousand = Math.floor(value / 1000)
  const rest = value % 1000
  const prefix = thousand === 1 ? 'mille' : `${numberToFrenchWords(thousand)} mille`
  return rest === 0 ? prefix : `${prefix} ${numberToFrenchWords(rest)}`
}

function amountToWords(amount: number, currency: string): string {
  const main = Math.floor(amount)
  const millimes = Math.round((amount - main) * 1000)
  const currencyLabel = currency.toUpperCase() === 'DT' ? 'dinars' : currency.toLowerCase()
  const base = `${numberToFrenchWords(main)} ${currencyLabel}`
  if (millimes <= 0) return base
  return `${base} ${numberToFrenchWords(millimes)} millimes`
}

function getAmountWordsPrefix(title: string): string {
  if (title === 'BON DE LIVRAISON') return 'Arrêté Le Présent Bon de Livraison à La Somme de '
  if (title === 'DEVIS') return 'Arrêté Le Présent Devis à La Somme de '
  return 'Arrêté La Présente Facture à La Somme de '
}

function shouldShowDeliveryBand(title: string): boolean {
  return title === 'FACTURE' || title === 'BON DE LIVRAISON'
}

function createPage(doc: PDFDocument): PDFPage {
  return doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
}

function createContext(doc: PDFDocument, page: PDFPage, font: PDFFont, fontBold: PDFFont, fontSerif?: PDFFont): PageContext {
  return { doc, page, font, fontBold, fontSerif, y: PAGE_HEIGHT - MARGIN }
}

function drawPageNumbers(doc: PDFDocument, font: PDFFont, size: number) {
  const pages = doc.getPages()
  pages.forEach((page, index) => {
    if (pages.length <= 1) return
    const text = `Page ${index + 1} / ${pages.length}`
    const width = textWidth(font, text, size)
    drawLeft(page, text, PAGE_WIDTH - MARGIN - width, FOOTER_Y - 8, font, size, COLORS.mediumGray)
  })
}

function drawInvoiceHeader(ctx: PageContext, inv: InvoiceDoc, title: string): PageContext {
  const { page, font, fontBold, fontSerif } = ctx
  const titleFont = fontSerif ?? fontBold
  const titleY = ctx.y
  drawLeft(page, title, MARGIN, titleY, titleFont, FONT_SIZES.title, COLORS.invoiceBlue)
  drawLeft(page, `Numéro ${inv.reference || '—'}`, MARGIN, titleY - 22, fontBold, FONT_SIZES.meta, COLORS.black)
  drawLeft(page, `DU: ${formatDate(inv.createdAt) || '—'}`, MARGIN, titleY - 36, font, FONT_SIZES.meta, COLORS.black)
  return { ...ctx, y: titleY - 52 }
}

function drawCompanyAndCustomerBoxes(ctx: PageContext, inv: InvoiceDoc, cfg: SettingsDoc): PageContext {
  const { page, font, fontBold } = ctx
  const boxGap = 8
  const boxWidth = (CONTENT_WIDTH - boxGap) / 2
  const leftBoxX = MARGIN
  const rightBoxX = MARGIN + boxWidth + boxGap
  const topY = ctx.y

  const sellerFields = buildSellerFields(cfg)
  const customerFields = buildCustomerFields(inv)
  const boxHeight = Math.max(
    estimatePartyBoxHeight(sellerFields.length),
    estimatePartyBoxHeight(customerFields.length)
  )

  drawPartyBox(
    page,
    leftBoxX,
    topY,
    boxWidth,
    boxHeight,
    'VENDEUR',
    cfg.companyName || '—',
    sellerFields,
    font,
    fontBold
  )

  drawPartyBox(
    page,
    rightBoxX,
    topY,
    boxWidth,
    boxHeight,
    'CLIENT',
    inv.customerName || 'Client comptant',
    customerFields.filter((field) => field.label.toLowerCase() !== 'client'),
    font,
    fontBold
  )

  return { ...ctx, y: topY - boxHeight - HEADER_GAP }
}

function drawDeliveryBand(ctx: PageContext, inv: InvoiceDoc): PageContext {
  const { page, font, fontBold } = ctx
  const bandHeight = 20
  const bandY = ctx.y
  drawBox(page, MARGIN, bandY - bandHeight, CONTENT_WIDTH, bandHeight, COLORS.black, 0.5)

  const blNumber = inv.blNumber || inv.reference || ''
  const blDate = formatDate(inv.createdAt)
  drawLeft(
    page,
    `B.LIVRAISON N° ${blNumber} DU: ${blDate}`,
    MARGIN + 6,
    bandY - 14,
    fontBold,
    FONT_SIZES.value,
    COLORS.black
  )
  drawLeft(
    page,
    `CMDE N° ${inv.pieceNumber || inv.bcNumber || ''}`.trimEnd(),
    PAGE_WIDTH - MARGIN - 120,
    bandY - 14,
    fontBold,
    FONT_SIZES.value,
    COLORS.black
  )
  return { ...ctx, y: bandY - bandHeight - HEADER_GAP }
}

function drawTableHeader(ctx: PageContext): PageContext {
  const { page, fontBold } = ctx
  const topY = ctx.y
  drawBox(page, MARGIN, topY - TABLE_HEADER_HEIGHT, CONTENT_WIDTH, TABLE_HEADER_HEIGHT, COLORS.black, 0.5)

  const headerY = topY - 15
  drawCenter(page, 'N/L', TABLE_COLUMNS.number.x, TABLE_COLUMNS.number.w, headerY, fontBold, FONT_SIZES.tableHeader)
  drawCenter(page, 'REFERENCES', TABLE_COLUMNS.reference.x, TABLE_COLUMNS.reference.w, headerY, fontBold, FONT_SIZES.tableHeader)
  drawCenter(page, 'DESIGNATIONS', TABLE_COLUMNS.designation.x, TABLE_COLUMNS.designation.w, headerY, fontBold, FONT_SIZES.tableHeader)
  drawCenter(page, 'QTE', TABLE_COLUMNS.qte.x, TABLE_COLUMNS.qte.w, headerY, fontBold, FONT_SIZES.tableHeader)
  drawCenter(page, 'P.U.H.T', TABLE_COLUMNS.puht.x, TABLE_COLUMNS.puht.w, headerY, fontBold, FONT_SIZES.tableHeader)
  drawCenter(page, 'REM', TABLE_COLUMNS.rm.x, TABLE_COLUMNS.rm.w, headerY, fontBold, FONT_SIZES.tableHeader)
  drawCenter(page, 'M.H.T', TABLE_COLUMNS.mht.x, TABLE_COLUMNS.mht.w, headerY, fontBold, FONT_SIZES.tableHeader)  
  drawCenter(page, 'TVA', TABLE_COLUMNS.tva.x, TABLE_COLUMNS.tva.w, headerY, fontBold, FONT_SIZES.tableHeader)
  drawCenter(page, 'MONTANT TTC', TABLE_COLUMNS.net.x, TABLE_COLUMNS.net.w, headerY, fontBold, FONT_SIZES.tableHeader)
  drawTableColumnLines(page, topY, topY - TABLE_HEADER_HEIGHT)

  return { ...ctx, y: topY - TABLE_HEADER_HEIGHT }
}

function drawTableColumnLines(page: PDFPage, topY: number, bottomY: number) {
  ;[
    TABLE_COLUMNS.reference.x,
    TABLE_COLUMNS.designation.x,
    TABLE_COLUMNS.qte.x,
    TABLE_COLUMNS.puht.x,
    TABLE_COLUMNS.rm.x,
    TABLE_COLUMNS.mht.x,    
    TABLE_COLUMNS.tva.x,
    TABLE_COLUMNS.net.x,
    PAGE_WIDTH - MARGIN
  ].forEach((x) => drawLine(page, x, bottomY, x, topY, 0.5, COLORS.black))
}

function drawTableRow(ctx: PageContext, line: InvoiceLine, lineNumber: number): PageContext {
  const { page, font } = ctx
  const rowTop = ctx.y
  const rowBottom = rowTop - TABLE_ROW_HEIGHT
  drawLine(page, MARGIN, rowBottom, PAGE_WIDTH - MARGIN, rowBottom, 0.5, COLORS.black)

  const netHT = line.totalHT
  const lineTTC = line.totalTTC ?? netHT
  const rowY = rowTop - 13
  drawCenter(page, String(lineNumber), TABLE_COLUMNS.number.x, TABLE_COLUMNS.number.w, rowY, font, FONT_SIZES.tableRow)
  drawLeft(
    page,
    truncate(font, line.reference || '', FONT_SIZES.tableRow, TABLE_COLUMNS.reference.w - 4),
    TABLE_COLUMNS.reference.x + 3,
    rowY,
    font,
    FONT_SIZES.tableRow
  )
  drawLeft(
    page,
    truncate(font, line.designation, FONT_SIZES.tableRow, TABLE_COLUMNS.designation.w - 6),
    TABLE_COLUMNS.designation.x + 3,
    rowY,
    font,
    FONT_SIZES.tableRow
  )
  drawCenter(page, fmtQty(line.quantity), TABLE_COLUMNS.qte.x, TABLE_COLUMNS.qte.w, rowY, font, FONT_SIZES.tableRow)
  drawRight(page, fmt3(line.unitPrice), TABLE_COLUMNS.puht.x, TABLE_COLUMNS.puht.w - 3, rowY, font, FONT_SIZES.tableRow)
  drawCenter(page, `${line.discount ?? 0}`, TABLE_COLUMNS.rm.x, TABLE_COLUMNS.rm.w, rowY, font, FONT_SIZES.tableRow)
  drawRight(page, fmt3(line.totalHT), TABLE_COLUMNS.mht.x, TABLE_COLUMNS.mht.w - 3, rowY, font, FONT_SIZES.tableRow)  
  drawCenter(page, `${line.tva ?? 19}`, TABLE_COLUMNS.tva.x, TABLE_COLUMNS.tva.w, rowY, font, FONT_SIZES.tableRow)
  drawRight(page, fmt3(lineTTC), TABLE_COLUMNS.net.x, TABLE_COLUMNS.net.w - 4, rowY, font, FONT_SIZES.tableRow)
  drawTableColumnLines(page, rowTop, rowBottom)

  return { ...ctx, y: rowBottom }
}

function drawTableGridFiller(ctx: PageContext, tableBottom: number) {
  const { page } = ctx
  if (ctx.y <= tableBottom) return
  drawLine(page, MARGIN, tableBottom, PAGE_WIDTH - MARGIN, tableBottom, 0.5, COLORS.black)
  drawTableColumnLines(page, ctx.y, tableBottom)
  drawLine(page, MARGIN, tableBottom, MARGIN, ctx.y, 0.5, COLORS.black)
  drawLine(page, PAGE_WIDTH - MARGIN, tableBottom, PAGE_WIDTH - MARGIN, ctx.y, 0.5, COLORS.black)
}

function startContinuationPage(ctx: PageContext): PageContext {
  const newPage = createPage(ctx.doc)
  const newCtx = createContext(ctx.doc, newPage, ctx.font, ctx.fontBold, ctx.fontSerif)
  return drawTableHeader(newCtx)
}

function ensureTableSpace(ctx: PageContext, tableBottom: number): PageContext {
  if (ctx.y - TABLE_ROW_HEIGHT < tableBottom) {
    drawTableGridFiller(ctx, tableBottom)
    return startContinuationPage(ctx)
  }
  return ctx
}

function drawTaxBox(page: PDFPage, font: PDFFont, fontBold: PDFFont, inv: InvoiceDoc, layout: SummaryLayout) {
  const boxX = MARGIN
  const boxY = layout.summaryBottom + TOTALS_BOX_HEIGHT - TAX_BOX_HEIGHT
  drawBox(page, boxX, boxY, TAX_BOX_WIDTH, TAX_BOX_HEIGHT, COLORS.black, 0.5)
  drawLine(page, boxX, boxY + TAX_BOX_HEIGHT - 16, boxX + TAX_BOX_WIDTH, boxY + TAX_BOX_HEIGHT - 16, 0.5, COLORS.black)
  drawLine(page, boxX + 88, boxY, boxX + 88, boxY + TAX_BOX_HEIGHT, 0.5, COLORS.black)
  drawLine(page, boxX + 148, boxY, boxX + 148, boxY + TAX_BOX_HEIGHT, 0.5, COLORS.black)

  drawLeft(page, 'BASE TAXABLE', boxX + 4, boxY + TAX_BOX_HEIGHT - 12, fontBold, FONT_SIZES.value, COLORS.black)
  drawLeft(page, 'TAUX', boxX + 94, boxY + TAX_BOX_HEIGHT - 12, fontBold, FONT_SIZES.value, COLORS.black)
  drawLeft(page, 'MONTANT TVA', boxX + 154, boxY + TAX_BOX_HEIGHT - 12, fontBold, FONT_SIZES.value, COLORS.black)

  // Regrouper les lignes par taux TVA
  const vatGroups = new Map<number, { base: number; tva: number }>()
  inv.lines.forEach((line) => {
    const tvaRate = line.tva ?? 0
    const base = line.totalHT ?? 0
    // Preferer le montant TVA déjà calculé, sinon recalculer si includeTva est true
    let tvaAmount = (line.totalTTC ?? 0) - (line.totalHT ?? 0)
    if ((tvaAmount === 0 || Number.isNaN(tvaAmount)) && inv.includeTva && (line.tva ?? 0) > 0) {
      tvaAmount = base * ((line.tva ?? 0) / 100)
    }

    if (!vatGroups.has(tvaRate)) {
      vatGroups.set(tvaRate, { base: 0, tva: 0 })
    }
    const group = vatGroups.get(tvaRate)!
    group.base += base
    group.tva += tvaAmount
  })

  // Afficher chaque groupe de taux TVA
  let yOffset = boxY + 4
  vatGroups.forEach((group, rate) => {
    if (group.base > 0 || group.tva > 0) {
      drawLeft(page, fmt3(group.base), boxX + 4, yOffset, font, FONT_SIZES.value, COLORS.black)
      drawCenter(page, rate.toFixed(2), boxX + 88, 60, yOffset, font, FONT_SIZES.value, COLORS.black)
      drawRight(page, fmt3(group.tva), boxX + 148, TAX_BOX_WIDTH - 148, yOffset, font, FONT_SIZES.value, COLORS.black)
      yOffset -= 12
    }
  })

  // Si aucun groupe avec TVA, afficher le total HT avec taux 0
  if (vatGroups.size === 0 || (vatGroups.size === 1 && vatGroups.has(0))) {
    drawLeft(page, fmt3(inv.totalHT), boxX + 4, boxY + 4, font, FONT_SIZES.value, COLORS.black)
    drawCenter(page, '0.00', boxX + 88, 60, boxY + 4, font, FONT_SIZES.value, COLORS.black)
    drawRight(page, fmt3(inv.totalTVA), boxX + 148, TAX_BOX_WIDTH - 148, boxY + 4, font, FONT_SIZES.value, COLORS.black)
  }
}

function drawTotalsBox(page: PDFPage, font: PDFFont, fontBold: PDFFont, inv: InvoiceDoc, cfg: SettingsDoc, title: string, layout: SummaryLayout) {
  const boxX = PAGE_WIDTH - MARGIN - TOTALS_BOX_WIDTH
  const boxY = layout.summaryBottom
  drawBox(page, boxX, boxY, TOTALS_BOX_WIDTH, TOTALS_BOX_HEIGHT, COLORS.black, 0.5)

  const isInvoice = title === 'FACTURE'
  const timbreAmount = isInvoice
    ? (inv.timbreFiscal ?? 0) > 0
      ? inv.timbreFiscal!
      : TIMBRE_FISCAL_AMOUNT
    : inv.timbreFiscal ?? 0

  const rows: Array<[string, string, boolean]> = [
    ['TOTAL HT', fmt3(inv.totalHT), false],
    ['REMISE', fmt2(0), false],
    ['TOTAL NET HT', fmt2(inv.totalHT), false],
    ['MONTANT TVA', fmt2(inv.totalTVA), false]
  ]

  if (isInvoice || timbreAmount > 0) {
    rows.push(['TIMBRE', fmt2(timbreAmount), false])
  }

  rows.push(['TOTAL TTC', fmt2(inv.totalTTC), true])

  let rowY = boxY + TOTALS_BOX_HEIGHT - 14
  rows.forEach(([label, value, bold]) => {
    drawLeft(page, label, boxX + 6, rowY, bold ? fontBold : font, FONT_SIZES.totalLabel, COLORS.black)
    drawRight(page, value, boxX + 6, TOTALS_BOX_WIDTH - 12, rowY, bold ? fontBold : font, FONT_SIZES.totalLabel, COLORS.black)
    rowY -= 13
  })

  const netY = boxY + 6
  const netValue = fmt3(inv.totalTTC)
  drawLeft(page, 'NET A PAYER', boxX + 6, netY + 10, fontBold, FONT_SIZES.totalValue, COLORS.black)
  drawRight(page, netValue, boxX + 6, TOTALS_BOX_WIDTH - 12, netY + 10, fontBold, FONT_SIZES.netValue, COLORS.black)
  const netWidth = textWidth(fontBold, netValue, FONT_SIZES.netValue)
  // drawLine(page, boxX + TOTALS_BOX_WIDTH - 12 - netWidth, netY + 8, boxX + TOTALS_BOX_WIDTH - 12, netY + 8, 0.6, COLORS.black)
}

function drawAmountInWords(page: PDFPage, font: PDFFont, inv: InvoiceDoc, cfg: SettingsDoc, layout: SummaryLayout, title: string) {
  const prefix = getAmountWordsPrefix(title)
  const words = amountToWords(inv.totalTTC, cfg.currency)
  const fullText = `${prefix}${words}`
  const maxWidth = CONTENT_WIDTH - TOTALS_BOX_WIDTH - 16
  const wrapped = wrapLines(font, fullText, FONT_SIZES.value, maxWidth)
  let lineY = layout.wordsTop - 10
  wrapped.slice(0, 2).forEach((line) => {
    drawLeft(page, line, MARGIN, lineY, font, FONT_SIZES.value, COLORS.black)
    lineY -= 11
  })
}

function drawFooterBoxes(page: PDFPage, font: PDFFont, fontBold: PDFFont, inv: InvoiceDoc, layout: SummaryLayout) {
  const footerY = layout.footerBottom
  const boxWidth = (CONTENT_WIDTH - FOOTER_BOX_GAP * 2) / 3
  const { driverName, driverCin, plate } = resolveDeliveryInfo(inv)

  const boxes: Array<{ label: string; lines: string[] }> = [
    {
      label: 'LIVREUR',
      lines: [driverName, driverCin ? `CIN : ${driverCin}` : ''].filter(Boolean)
    },
    {
      label: 'MATRICULE VEHICULE',
      lines: [plate].filter(Boolean)
    },
    { label: 'SIGNATURE / CACHET', lines: [] }
  ]

  boxes.forEach((box, index) => {
    const boxX = MARGIN + index * (boxWidth + FOOTER_BOX_GAP)
    drawBox(page, boxX, footerY, boxWidth, FOOTER_HEIGHT, COLORS.black, 0.5)
    drawLeft(page, box.label, boxX + 6, footerY + FOOTER_HEIGHT - 14, fontBold, FOOTER_FONT_SIZE, COLORS.black)

    let lineY = footerY + FOOTER_HEIGHT - 28
    box.lines.forEach((line) => {
      drawLeft(page, line.toUpperCase(), boxX + 6, lineY, fontBold, FONT_SIZES.boxValue, COLORS.black)
      lineY -= 13
    })
  })
}

function drawQuoteValidityNote(page: PDFPage, fontBold: PDFFont, inv: InvoiceDoc, layout: SummaryLayout) {
  if (!inv.validUntil) return
  const text = `Valable jusqu'au : ${formatDate(inv.validUntil)}`
  drawLeft(page, text, MARGIN, layout.wordsTop + 4, fontBold, FONT_SIZES.value, COLORS.black)
}

function drawSummarySection(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  inv: InvoiceDoc,
  cfg: SettingsDoc,
  title: string,
  layout: SummaryLayout
) {
  drawTaxBox(page, font, fontBold, inv, layout)
  drawTotalsBox(page, font, fontBold, inv, cfg, title, layout)
  drawAmountInWords(page, font, inv, cfg, layout, title)
  drawFooterBoxes(page, font, fontBold, inv, layout)
}

function createInvoicePage(
  doc: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  fontSerif: PDFFont,
  inv: InvoiceDoc,
  cfg: SettingsDoc,
  title: string
): PageContext {
  const page = createPage(doc)
  let ctx = createContext(doc, page, font, fontBold, fontSerif)
  ctx = drawInvoiceHeader(ctx, inv, title)
  ctx = drawCompanyAndCustomerBoxes(ctx, inv, cfg)
  if (shouldShowDeliveryBand(title)) {
    ctx = drawDeliveryBand(ctx, inv)
  }
  ctx = drawTableHeader(ctx)
  return ctx
}

export async function generateFactureClassiquePdf(
  invoice: InvoiceDoc | Document,
  settings: SettingsDoc | Document
): Promise<Uint8Array> {
  return generateInvoicePdf(invoice, settings, 'FACTURE')
}

export async function generateInvoicePdf(
  invoice: InvoiceDoc | Document,
  settings: SettingsDoc | Document,
  title = 'FACTURE'
): Promise<Uint8Array> {
  const inv = 'toObject' in invoice ? invoice.toObject() : invoice
  const cfg = 'toObject' in settings ? settings.toObject() : settings
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontSerif = await doc.embedFont(StandardFonts.TimesRomanBold)

  const layout = computeSummaryLayout()
  const continuationTableBottom = MARGIN + 20
  let ctx = createInvoicePage(doc, font, fontBold, fontSerif, inv, cfg, title)

  inv.lines.forEach((line, index) => {
    const isLastLine = index === inv.lines.length - 1
    const tableBottom = isLastLine ? layout.tableBottom : continuationTableBottom
    ctx = ensureTableSpace(ctx, tableBottom)
    ctx = drawTableRow(ctx, line, index + 1)
  })

  drawTableGridFiller(ctx, layout.tableBottom)
  if (title === 'DEVIS') {
    drawQuoteValidityNote(ctx.page, fontBold, inv, layout)
  }
  drawSummarySection(ctx.page, font, fontBold, inv, cfg, title, layout)
  drawPageNumbers(doc, font, 8)

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
  if (s.includeTva) {
    lines.push(`TVA: ${s.totalTVA.toFixed(3)} ${cfg.currency}\n`)
  }
  if ((s.timbreFiscal ?? 0) > 0) {
    lines.push(`Timbre: ${s.timbreFiscal!.toFixed(3)} ${cfg.currency}\n`)
  }
  lines.push(`TOTAL: ${s.totalTTC.toFixed(3)} ${cfg.currency}\n`)
  lines.push(`PAYE: ${s.amountPaid.toFixed(3)} ${cfg.currency}\n`)
  lines.push(`${ESC}!\x08RESTE: ${s.amountDue.toFixed(3)} ${cfg.currency}\n`)
  lines.push('--------------------------------\n')
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