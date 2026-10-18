import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && (process.env.WORKERS_CI === '1' || process.env.CF_PAGES === '1')) {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const invalid = ['VITE_APP_BACKEND', 'VITE_AUTH_SERVICE_BACKEND', 'VITE_WORKBENCH_URL'].filter((key) => {
      const value = env[key]?.trim()
      if (!value) return true
      try {
        const url = new URL(value)
        return !['http:', 'https:'].includes(url.protocol)
      } catch {
        return true
      }
    })
    if (env.VITE_TURNSTILE_ENABLED?.trim().toLowerCase() !== 'false' && !env.VITE_CLOUDFLARE_SITE_KEY?.trim()) {
      invalid.push('VITE_CLOUDFLARE_SITE_KEY')
    }
    if (invalid.length) {
      throw new Error(
        `Missing or invalid Cloudflare build variables: ${invalid.join(', ')}. ` +
        'Set them in Settings > Build > Build Variables and Secrets, then rebuild. ' +
        'Backend URLs must be absolute HTTP(S) URLs.'
      )
    }
  }

  return {
    plugins: [react()],
  }
})
