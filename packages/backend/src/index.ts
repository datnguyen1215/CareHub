import 'dotenv/config'
import { createApp } from './app'
import { logger } from './services/logger'

const PORT = parseInt(process.env.PORT ?? '9391', 10)
const app = createApp()

app.listen(PORT, () => {
  logger.info(`CareHub backend listening on port ${PORT}`)
})
