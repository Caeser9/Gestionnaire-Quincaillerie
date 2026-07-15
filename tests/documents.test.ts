import { describe, expect, it } from 'vitest'
import { buildDocumentTotals, mergeDocumentLines } from '@shared/utils'

describe('document helpers', () => {
  it('merges delivery-note lines into a single invoice payload', () => {
    const merged = mergeDocumentLines([
      {
        designation: 'Vis 4x20',
        quantity: 2,
        unitPrice: 3,
        discount: 0,
        tva: 19,
        totalHT: 6,
        totalTTC: 7.14
      },
      {
        designation: 'Vis 4x20',
        quantity: 1,
        unitPrice: 3,
        discount: 0,
        tva: 19,
        totalHT: 3,
        totalTTC: 3.57
      }
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ designation: 'Vis 4x20', quantity: 3, unitPrice: 3 })
  })

  it('keeps quote totals without any fiscal stamp', () => {
    const totals = buildDocumentTotals([
      {
        designation: 'Produit',
        quantity: 1,
        unitPrice: 10,
        discount: 0,
        tva: 19,
        totalHT: 10,
        totalTTC: 11.9
      }
    ], { includeTva: true, timbreFiscal: 0 })

    expect(totals.totalHT).toBe(10)
    expect(totals.totalTTC).toBe(11.9)
    expect(totals.timbreFiscal).toBe(0)
  })

  it('supports generating a delivery note from invoice lines', () => {
    const totals = buildDocumentTotals([
      {
        designation: 'Produit',
        quantity: 2,
        unitPrice: 10,
        discount: 0,
        tva: 19,
        totalHT: 20,
        totalTTC: 23.8
      }
    ], { includeTva: true, timbreFiscal: 0 })

    expect(totals.totalHT).toBe(20)
    expect(totals.totalTTC).toBe(23.8)
  })
})
