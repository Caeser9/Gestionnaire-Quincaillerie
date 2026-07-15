import { describe, expect, it } from 'vitest'
import { extractProductSearchResults } from '../src/modules/POS/utils/posSearch'

describe('extractProductSearchResults', () => {
  it('returns products from a direct array payload', () => {
    const products = [{ _id: '1', designation: 'Vis' }]
    expect(extractProductSearchResults(products as never)).toEqual(products)
  })

  it('returns products from a paginated payload', () => {
    const payload = { data: [{ _id: '2', designation: 'Marteau' }] }
    expect(extractProductSearchResults(payload as never)).toEqual(payload.data)
  })

  it('returns an empty array for an empty or unsupported payload', () => {
    expect(extractProductSearchResults(undefined as never)).toEqual([])
    expect(extractProductSearchResults({ foo: 'bar' } as never)).toEqual([])
  })
})
