# PyChain frontend — Next.js dev server on :3000.
# Used by the root docker-compose.yml for one-command local dev.
FROM node:20-alpine

# libc6-compat avoids glibc/musl mismatches for native modules on Alpine
# (recommended by the Next.js Docker guidance).
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install deps first so the layer caches across source changes. The lockfile is
# optional (`*`) — CI uses `npm install`, not `npm ci` (cross-platform lockfile).
COPY package.json package-lock.json* ./
RUN npm install

# Copy the app. (At dev time docker-compose bind-mounts the source over this and
# keeps the image's node_modules via an anonymous volume.)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
