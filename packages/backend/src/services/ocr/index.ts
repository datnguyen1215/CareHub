/**
 * OCR service factory.
 * Creates the appropriate OCR service based on environment configuration.
 */

import type { OCRService } from './types.js'
import { TesseractOCR } from './tesseract.js'
import { GoogleVisionOCR } from './google.js'
import { logger } from '../logger.js'

export type { OCRService } from './types.js'

const OCR_PROVIDER = process.env.OCR_PROVIDER ?? 'tesseract'

let ocrInstance: OCRService | null = null

/** Returns the configured OCR service singleton */
export function getOCRService(): OCRService {
  if (!ocrInstance) {
    if (OCR_PROVIDER === 'google') {
      logger.info('Initializing Google Vision OCR service')
      ocrInstance = new GoogleVisionOCR()
    } else {
      logger.info('Initializing Tesseract OCR service')
      ocrInstance = new TesseractOCR()
    }
  }
  return ocrInstance
}

/** For testing: reset the OCR instance */
export function resetOCRService(): void {
  ocrInstance = null
}

export { TesseractOCR } from './tesseract.js'
export { GoogleVisionOCR } from './google.js'
