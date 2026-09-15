FROM node:22-bookworm-slim

# Chrome's system dependencies for headless rendering on Linux (Remotion's documented list)
RUN apt-get update && apt-get install -y \
  libnss3 \
  libdbus-1-3 \
  libatk1.0-0 \
  libgbm-dev \
  libasound2 \
  libxrandr2 \
  libxkbcommon-dev \
  libxfixes3 \
  libxcomposite1 \
  libxdamage1 \
  libatk-bridge2.0-0 \
  libpango-1.0-0 \
  libcairo2 \
  libcups2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY tsconfig.json remotion.config.ts ./
COPY src ./src
COPY public ./public
COPY server ./server

# Downloads Remotion's Chrome Headless Shell binary into the image
RUN npx remotion browser ensure

EXPOSE 4321
CMD ["npx", "tsx", "server/index.ts"]
