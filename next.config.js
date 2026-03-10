/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid corrupted webpack cache (MODULE_NOT_FOUND .js chunks, ENOENT .pack.gz) on Windows/dev
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false
    }
    return config
  },
}

module.exports = nextConfig
