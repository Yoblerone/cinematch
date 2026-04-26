const { PHASE_DEVELOPMENT_SERVER } = require('next/constants')

/** @type {(phase: string) => import('next').NextConfig} */
module.exports = (phase) => ({
  // Keep dev/prod artifacts isolated so running `next dev` and `next start`
  // in separate terminals cannot invalidate each other's client chunk hashes.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',

  // Avoid corrupted webpack cache (MODULE_NOT_FOUND .js chunks, ENOENT .pack.gz) on Windows/dev
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false
    }
    return config
  },
})
