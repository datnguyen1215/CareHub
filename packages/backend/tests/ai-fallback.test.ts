import { describe, it, expect } from 'vitest'
import { FallbackAI } from '../src/services/ai/fallback'

describe('FallbackAI', () => {
  const fallback = new FallbackAI()

  describe('category detection', () => {
    it('detects lab results', async () => {
      const ocrText = 'LABORATORY RESULTS\nBlood Test Panel\nHemoglobin: 14.2 g/dL\nReference Range: 12-16'
      const result = await fallback.generateDescription(ocrText)
      expect(result.category).toBe('lab_result')
    })

    it('detects prescriptions', async () => {
      const ocrText = 'Rx #12345\nPrescription for John Doe\nTake 1 tablet twice daily\nDispense: 30 capsules'
      const result = await fallback.generateDescription(ocrText)
      expect(result.category).toBe('prescription')
    })

    it('detects insurance documents', async () => {
      const ocrText = 'Insurance Policy #ABC123\nMember ID: 987654\nCoverage: Medical\nDeductible: $500'
      const result = await fallback.generateDescription(ocrText)
      expect(result.category).toBe('insurance')
    })

    it('detects billing documents', async () => {
      const ocrText = 'Medical Invoice\nStatement Date: 01/15/2024\nAmount Due: $150.00\nPayment Due Date: 02/15/2024'
      const result = await fallback.generateDescription(ocrText)
      expect(result.category).toBe('billing')
    })

    it('detects imaging documents', async () => {
      const ocrText = 'Radiology Report\nX-Ray Chest\nImaging performed on 01/10/2024\nFindings: No abnormalities'
      const result = await fallback.generateDescription(ocrText)
      expect(result.category).toBe('imaging')
    })

    it('returns other for unrecognized documents', async () => {
      const ocrText = 'Random text that does not match any known category pattern here'
      const result = await fallback.generateDescription(ocrText)
      expect(result.category).toBe('other')
    })

    it('handles mixed content by choosing highest score', async () => {
      // More lab-related keywords than prescription
      const ocrText = 'Lab work results for patient - blood test, hemoglobin, glucose panel. Take medication.'
      const result = await fallback.generateDescription(ocrText)
      expect(result.category).toBe('lab_result')
    })
  })

  describe('description generation', () => {
    it('returns full text if under 100 chars', async () => {
      const ocrText = 'Short document text'
      const result = await fallback.generateDescription(ocrText)
      expect(result.description).toBe('Short document text')
    })

    it('truncates long text with ellipsis', async () => {
      const longText = 'This is a very long document text that exceeds one hundred characters and should be truncated at a natural word boundary to create a meaningful description.'
      const result = await fallback.generateDescription(longText)
      expect(result.description.length).toBeLessThanOrEqual(103) // 100 + "..."
      expect(result.description).toContain('...')
    })

    it('handles excessive whitespace', async () => {
      const ocrText = 'Multiple   spaces    and\n\nnewlines   everywhere'
      const result = await fallback.generateDescription(ocrText)
      expect(result.description).toBe('Multiple spaces and newlines everywhere')
    })
  })
})
