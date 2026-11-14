# check=skip=FromPlatformFlagConstDisallowed
# Kyara image: Node.js, the compiled sources, the production dependencies and both
# browsers pinned by Puppeteer (Firefox and Chrome), so that the scenario file decides
# which browser runs, without rebuilding the image.
# linux/amd64 only (also when built on an arm64 machine): Chrome for Testing has no
# Linux arm64 build.

FROM --platform=linux/amd64 node:26-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc AS node

FROM node AS base
WORKDIR /app
# The browsers are installed explicitly below: Puppeteer's postinstall script is not run
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Compiles the TypeScript sources
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY src src
RUN npm run build

# Production dependencies, without the files only used at development time
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && find node_modules -type f \( -name '*.map' -o -name '*.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.md' \) -delete \
 && find node_modules -type d -empty -delete

# Browsers pinned by the installed Puppeteer version
FROM deps AS browsers
ENV PUPPETEER_CACHE_DIR=/opt/puppeteer
RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip xz-utils \
 && npx puppeteer browsers install firefox \
 && npx puppeteer browsers install chrome \
 # Translations of Chrome's own user interface (only en-US is used)
 && find /opt/puppeteer/chrome -path '*/locales/*.pak' ! -name 'en-US.pak' -delete

# libgbm without its Mesa backend: Chrome needs libgbm.so.1 to start, but the backend
# (mesa-libgallium, which pulls libllvm and libz3: ~190 MB) is only loaded to use a GPU,
# and the browsers run without one
FROM base AS libgbm
RUN apt-get update \
 && cd /tmp && apt-get download libgbm1 \
 && dpkg-deb -x libgbm1_*.deb /tmp/libgbm

FROM node
# Shared libraries of Firefox and Chrome, fonts for rendering text, and tini as the
# init process (forwards signals and reaps the browsers' exited child processes)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      tini fonts-dejavu-core fonts-liberation \
      libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libcairo-gobject2 libcairo2 \
      libcups2t64 libdbus-1-3 libdrm2 libexpat1 libfontconfig1 libfreetype6 libglib2.0-0t64 \
      libgtk-3-0t64 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libx11-xcb1 \
      libxcb-shm0 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
      libxkbcommon0 libxrandr2 libxrender1 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=libgbm /tmp/libgbm/usr/lib/x86_64-linux-gnu/libgbm.so.1* /usr/lib/x86_64-linux-gnu/

ENV NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/opt/puppeteer \
    KYARA_HTTP_PORT=3000 \
    KYARA_HEADLESS=true
WORKDIR /app
COPY --from=browsers /opt/puppeteer /opt/puppeteer
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY package.json LICENSE ./

# The image's "node" user, by id so that Kubernetes can check `runAsNonRoot`
USER 1000:1000
EXPOSE 3000
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/main.js"]
