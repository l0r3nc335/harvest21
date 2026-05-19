import { flag } from 'flags/next'
import { vercelAdapter } from '@flags-sdk/vercel'

export const maintenanceMode = flag({
  key: 'maintenance-mode',
  adapter: vercelAdapter(),
  options: [
    { value: true, label: 'On' },
    { value: false, label: 'Off' },
  ],
})
