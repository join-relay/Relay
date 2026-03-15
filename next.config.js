/** @type {import('next').NextConfig} */
const path = require("path")
const fs = require("fs")
const { loadEnvConfig } = require("@next/env")

const projectDir = __dirname
process.env.RELAY_PROJECT_ROOT = projectDir
process.env.RELAY_ENV_LOCAL_PATH = path.join(projectDir, ".env.local")

// Force-load .env.local into process.env so RECALL_* and other vars are available even when
// Next.js skips env loading (e.g. when dotenv is in dependencies). Uses override so existing
// empty vars get replaced.
const dotenv = require("dotenv")
const envLocalPath = path.join(projectDir, ".env.local")
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true })
}

loadEnvConfig(projectDir)

const nextConfig = {}

module.exports = nextConfig
