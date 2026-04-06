/** Device routes — kiosk registration and caretaker device management. */
import { Router } from 'express'
import { registrationRouter } from './registration.js'
import { kioskRouter } from './kiosk.js'
import { pairingRouter } from './pairing.js'
import { managementRouter } from './management.js'
import { profilesRouter } from './profiles.js'

export const devicesRouter = Router()
devicesRouter.use('/', registrationRouter)
devicesRouter.use('/', kioskRouter)
devicesRouter.use('/', pairingRouter)
devicesRouter.use('/', managementRouter)
devicesRouter.use('/', profilesRouter)
