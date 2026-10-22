# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Prove the build inside the image: full test suite + H-MEM conformance.
RUN npm test && npm run conformance
# Default: the two-phase ZURA demo on frozen fixtures. No keys needed.
CMD ["npx", "tsx", "src/cli.ts", "demo"]
