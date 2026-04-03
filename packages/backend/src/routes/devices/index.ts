/** Device routes — kiosk registration and caretaker device management. */
import { Router } from 'express'
import { registrationRouter } from './registration'
import { kioskRouter } from './kiosk'
import { pairingRouter } from './pairing'
import { managementRouter } from './management'
import { profilesRouter } from './profiles'

export const devicesRouter = Router()
devicesRouter.use('/', registrationRouter)
devicesRouter.use('/', kioskRouter)
devicesRouter.use('/', pairingRouter)
devicesRouter.use('/', managementRouter)
devicesRouter.use('/', profilesRouter)
