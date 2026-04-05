/**
 * Attachment processor service.
 * Handles background OCR extraction and AI description generation for attachments.
 */

import path from 'path'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { attachments } from '@carehub/shared'
import { getOCRService } from './ocr'
import { generateDescription, type DocumentCategory } from './ai'
import { logger } from './logger'

// Supported image types for OCR processing
const OCR_SUPPORTED_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']

/** Timeout values (ms) for attachment processing steps */
const OCR_TIMEOUT_MS = 60_000
const AI_DESCRIPTION_TIMEOUT_MS = 30_000

/** Check if a file type supports OCR */
function isOCRSupported(fileUrl: string): boolean {
  const ext = path.extname(fileUrl).toLowerCase()
  return OCR_SUPPORTED_TYPES.includes(ext)
}

/**
 * Wraps a promise with a timeout. Rejects with an Error if the promise
 * doesn't settle within the given duration.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    }),
  ])
}

// Storage configuration — matches storage service
const UPLOADS_PATH = process.env.UPLOADS_PATH ?? path.join(process.cwd(), 'uploads')
const UPLOADS_URL_PREFIX = process.env.UPLOADS_URL_PREFIX ?? '/uploads'

/** Get full file path from URL for local storage */
function getFilePath(fileUrl: string): string {
  // fileUrl is like /uploads/uuid.jpg (or custom prefix)
  // Full path needs UPLOADS_PATH env var or default
  const prefix = UPLOADS_URL_PREFIX.endsWith('/') ? UPLOADS_URL_PREFIX : `${UPLOADS_URL_PREFIX}/`
  const filename = fileUrl.replace(prefix, '')
  return path.join(UPLOADS_PATH, filename)
}

/**
 * Process an attachment asynchronously — extracts OCR text and generates AI description.
 * Updates the attachment record when complete.
 * Failures are logged but don't affect the original upload.
 */
export async function processAttachment(attachmentId: string): Promise<void> {
  try {
    // Fetch attachment
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId))
      .limit(1)

    if (!attachment) {
      logger.warn({ attachmentId }, 'Attachment not found for processing')
      return
    }

    // Check if OCR is supported for this file type
    if (!isOCRSupported(attachment.file_url)) {
      logger.debug(
        { attachmentId, fileUrl: attachment.file_url },
        'File type not supported for OCR'
      )
      return
    }

    const filePath = getFilePath(attachment.file_url)
    logger.info({ attachmentId, filePath }, 'Starting OCR processing')

    // Extract OCR text
    let ocrText: string | null = null
    try {
      const ocrService = getOCRService()
      ocrText = await withTimeout(
        ocrService.extractText(filePath),
        OCR_TIMEOUT_MS,
        'OCR extraction'
      )
      logger.info({ attachmentId, textLength: ocrText.length }, 'OCR extraction complete')
    } catch (ocrErr) {
      const isTimeout = ocrErr instanceof Error && ocrErr.message.includes('timed out')
      if (isTimeout) {
        logger.warn({ attachmentId }, 'OCR extraction timed out, continuing without OCR text')
      } else {
        logger.error({ err: ocrErr, attachmentId }, 'OCR extraction failed')
      }
      // Continue — we can still update with null OCR text
    }

    // Generate AI description if we have OCR text
    let description: string | null = attachment.description
    let category: DocumentCategory = attachment.category

    if (ocrText && ocrText.length > 0) {
      try {
        // Only generate if no user-provided description
        if (!attachment.description) {
          const result = await withTimeout(
            generateDescription(ocrText),
            AI_DESCRIPTION_TIMEOUT_MS,
            'AI description generation'
          )
          description = result.description
          // Only update category if user didn't provide one (default is 'other')
          if (attachment.category === 'other') {
            category = result.category
          }
          logger.info({ attachmentId, category }, 'AI description generated')
        }
      } catch (aiErr) {
        const isTimeout = aiErr instanceof Error && aiErr.message.includes('timed out')
        if (isTimeout) {
          logger.warn({ attachmentId }, 'AI description generation timed out, continuing without description')
        } else {
          logger.error({ err: aiErr, attachmentId }, 'AI description generation failed')
        }
        // Continue — we'll still save the OCR text
      }
    }

    // Update attachment record
    await db
      .update(attachments)
      .set({
        ocr_text: ocrText,
        description: description,
        category: category,
        updated_at: new Date(),
      })
      .where(eq(attachments.id, attachmentId))

    logger.info({ attachmentId }, 'Attachment processing complete')
  } catch (err) {
    logger.error({ err, attachmentId }, 'Attachment processing failed')
  }
}

/**
 * Queue an attachment for background processing.
 * Uses setImmediate to avoid blocking the request.
 */
export function queueAttachmentProcessing(attachmentId: string): void {
  setImmediate(() => {
    processAttachment(attachmentId).catch((err) => {
      logger.error({ err, attachmentId }, 'Background attachment processing error')
    })
  })
}
