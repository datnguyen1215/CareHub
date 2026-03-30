/**
 * AI service types for description generation.
 * Supports multiple providers (OpenAI, Anthropic) with a common interface.
 */

export type DocumentCategory =
  | 'lab_result'
  | 'prescription'
  | 'insurance'
  | 'billing'
  | 'imaging'
  | 'other'

export interface DescriptionResult {
  description: string
  category: DocumentCategory
}

export interface AIService {
  /** Generates a description and category from OCR text */
  generateDescription(ocrText: string): Promise<DescriptionResult>
}

export interface AIConfig {
  provider: 'openai' | 'anthropic'
  apiKey: string
}
