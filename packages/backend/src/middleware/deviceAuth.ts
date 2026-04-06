/** Device auth middleware — validates device tokens for kiosk endpoints. */
import { Request, Response, NextFunction } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { devices } from '@carehub/shared'

export interface DevicePayload {
  deviceId: string
  deviceToken: string
}

declare global {
  namespace Express {
    interface Request {
      device?: DevicePayload
    }
  }
}

/**
 * Express middleware that validates device token from Authorization header.
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export const requireDeviceAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Device token required' })
    return
  }

  const deviceToken = authHeader.slice(7)
  if (!deviceToken) {
    res.status(401).json({ error: 'Device token required' })
    return
  }

  try {
    const [device] = await db
      .select({ id: devices.id, device_token: devices.device_token })
      .from(devices)
      .where(eq(devices.device_token, deviceToken))
      .limit(1)

    if (!device) {
      res.status(401).json({ error: 'Invalid device token' })
      return
    }

    req.device = {
      deviceId: device.id,
      deviceToken: device.device_token,
    }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid device token' })
  }
}
