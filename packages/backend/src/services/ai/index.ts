/**
 * AI service factory.
 * Creates the appropriate AI service based on environment configuration.
 */

import type { AIService, DescriptionResult } from './types.js'
import { OpenAIService } from './openai.js'
import { AnthropicService } from './anthropic.js'
import { FallbackAI } from './fallback.js'
import { logger } from '../logger.js'

export type { AIService, DescriptionResult, DocumentCategory } from './types.js'

const AI_PROVIDER = process.env.AI_PROVIDER ?? 'fallback'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

let aiInstance: AIService | null = null

/** Returns the configured AI service singleton */
export function getAIService(): AIService {
  if (!aiInstance) {
    if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
      logger.info('Initializing OpenAI service')
      aiInstance = new OpenAIService(OPENAI_API_KEY)
    } else if (AI_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY) {
      logger.info('Initializing Anthropic service')
      aiInstance = new AnthropicService(ANTHROPIC_API_KEY)
    } else {
      logger.info('Initializing fallback AI service (heuristic-based)')
      aiInstance = new FallbackAI()
    }
  }
  return aiInstance
}

/** For testing: reset the AI instance */
export function resetAIService(): void {
  aiInstance = null
}

/**
 * Generate description from OCR text with graceful fallback.
 * Falls back to heuristics if AI service fails.
 */
export async function generateDescription(ocrText: string): Promise<DescriptionResult> {
  const aiService = getAIService()

  try {
    return await aiService.generateDescription(ocrText)
  } catch (err) {
    logger.warn({ err }, 'AI service failed, using fallback heuristics')
    const fallback = new FallbackAI()
    return fallback.generateDescription(ocrText)
  }
}

export { OpenAIService } from './openai.js'
export { AnthropicService } from './anthropic.js'
export { FallbackAI } from './fallback.js'
