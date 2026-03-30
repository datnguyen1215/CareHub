/**
 * Fallback AI implementation using simple heuristics.
 * Used when AI APIs are unavailable.
 */

import type { AIService, DescriptionResult, DocumentCategory } from './types'

/** Keyword patterns for category detection */
const CATEGORY_KEYWORDS: Record<DocumentCategory, string[]> = {
  lab_result: [
    'lab',
    'laboratory',
    'blood',
    'urine',
    'test result',
    'specimen',
    'hemoglobin',
    'glucose',
    'cholesterol',
    'cbc',
    'panel',
    'reference range',
    'normal range',
  ],
  prescription: [
    'rx',
    'prescription',
    'refill',
    'dispense',
    'sig:',
    'take',
    'tablet',
    'capsule',
    'mg',
    'daily',
    'twice',
    'pharmacy',
    'prescriber',
    'dea',
    'npi',
  ],
  insurance: [
    'insurance',
    'policy',
    'coverage',
    'premium',
    'deductible',
    'copay',
    'co-pay',
    'claim',
    'member id',
    'group number',
    'effective date',
    'benefits',
  ],
  billing: [
    'invoice',
    'bill',
    'statement',
    'amount due',
    'balance',
    'payment',
    'charge',
    'total',
    'due date',
    'account number',
    'remit',
  ],
  imaging: [
    'x-ray',
    'xray',
    'mri',
    'ct scan',
    'ultrasound',
    'radiology',
    'imaging',
    'scan',
    'mammogram',
    'echocardiogram',
    'contrast',
  ],
  other: [],
}

export class FallbackAI implements AIService {
  async generateDescription(ocrText: string): Promise<DescriptionResult> {
    const category = this.detectCategory(ocrText)
    const description = this.generateFallbackDescription(ocrText)

    return { description, category }
  }

  private detectCategory(text: string): DocumentCategory {
    const lowerText = text.toLowerCase()
    const scores: Record<DocumentCategory, number> = {
      lab_result: 0,
      prescription: 0,
      insurance: 0,
      billing: 0,
      imaging: 0,
      other: 0,
    }

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          scores[category as DocumentCategory]++
        }
      }
    }

    // Find category with highest score
    let maxCategory: DocumentCategory = 'other'
    let maxScore = 0

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score
        maxCategory = category as DocumentCategory
      }
    }

    return maxCategory
  }

  private generateFallbackDescription(text: string): string {
    // Clean up text — remove excessive whitespace
    const cleaned = text.replace(/\s+/g, ' ').trim()

    // Return first 100 chars as description
    if (cleaned.length <= 100) {
      return cleaned
    }

    // Find a natural break point
    const truncated = cleaned.slice(0, 100)
    const lastSpace = truncated.lastIndexOf(' ')

    if (lastSpace > 50) {
      return truncated.slice(0, lastSpace) + '...'
    }

    return truncated + '...'
  }
}
