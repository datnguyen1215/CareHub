/**
 * Anthropic Claude AI implementation for description generation.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { AIService, DescriptionResult, DocumentCategory } from './types'
import { logger } from '../logger'

const VALID_CATEGORIES: DocumentCategory[] = [
  'lab_result',
  'prescription',
  'insurance',
  'billing',
  'imaging',
  'other',
]

const SYSTEM_PROMPT = `You are a medical document analyzer. Given the OCR text from a medical document, you must:
1. Summarize the document in 1-2 sentences (max 200 characters)
2. Identify the document type from these categories: lab_result, prescription, insurance, billing, imaging, other

Respond ONLY with valid JSON in this exact format:
{"description": "brief summary here", "category": "category_here"}

Do not include any other text or explanation.`

export class AnthropicService implements AIService {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async generateDescription(ocrText: string): Promise<DescriptionResult> {
    try {
      // Truncate OCR text to avoid token limits
      const truncatedText = ocrText.slice(0, 4000)

      const response = await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `OCR Text:\n${truncatedText}` }],
      })

      const content = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
      if (!content) {
        throw new Error('Empty response from Anthropic')
      }

      const parsed = JSON.parse(content) as { description: string; category: string }

      // Validate category
      const category = VALID_CATEGORIES.includes(parsed.category as DocumentCategory)
        ? (parsed.category as DocumentCategory)
        : 'other'

      return {
        description: (parsed.description ?? '').slice(0, 500),
        category,
      }
    } catch (err) {
      logger.error({ err }, 'Anthropic description generation failed')
      throw err
    }
  }
}
