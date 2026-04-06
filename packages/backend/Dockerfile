# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json ./

# Copy package manifests
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install all dependencies
RUN npm ci --workspace=packages/backend --workspace=packages/shared --include-workspace-root

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

# Build shared then backend
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/backend

# Run stage
FROM node:20-alpine AS run

WORKDIR /app

# Create non-root user
RUN addgroup -S carehub && adduser -S carehub -G carehub

# Copy workspace root package files for npm workspaces resolution
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install production dependencies only
RUN npm ci --workspace=packages/backend --workspace=packages/shared --include-workspace-root --omit=dev

# Copy built output
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/backend/dist ./packages/backend/dist

RUN chown -R carehub:carehub /app
USER carehub

EXPOSE 9391

CMD ["node", "packages/backend/dist/index.js"]
