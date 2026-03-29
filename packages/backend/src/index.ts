import 'dotenv/config'
import { createApp } from './app'

const PORT = parseInt(process.env.PORT ?? '9391', 10)
const app = createApp()

app.listen(PORT, () => {
  console.log(`CareHub backend listening on port ${PORT}`)
})
