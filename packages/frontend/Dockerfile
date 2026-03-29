# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json ./

# Copy package manifests
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/

# Install all dependencies
RUN npm ci --workspace=packages/frontend --workspace=packages/shared --include-workspace-root

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/

# Build shared then frontend
RUN npm run build --workspace=packages/shared 2>/dev/null || true
RUN npm run build --workspace=packages/frontend

# Run stage
FROM node:20-alpine AS run

WORKDIR /app

# Create non-root user
RUN addgroup -S carehub && adduser -S carehub -G carehub

# Copy built output (adapter-node outputs to build/)
COPY --from=build /app/packages/frontend/build ./build
COPY --from=build /app/packages/frontend/package.json ./package.json

# Install production runtime deps
RUN npm install --omit=dev 2>/dev/null || true

RUN chown -R carehub:carehub /app
USER carehub

EXPOSE 9390

CMD ["node", "build"]
