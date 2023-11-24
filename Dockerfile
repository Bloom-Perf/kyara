FROM --platform=linux/amd64 node:21@sha256:84bb4077fd52933a935e7057ba9991e7cb18487b0ba444835dd44975aa94b7b2 AS builder

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
COPY tsconfig.json ./

COPY ./src src

ARG NPM_TOKEN
RUN echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" > .npmrc
RUN PUPPETEER_PRODUCT=firefox npm install
RUN rm -rf .npmrc
RUN npm run build

# Production deployment
# TODO: Should use a bundler

FROM --platform=linux/amd64 node:21@sha256:84bb4077fd52933a935e7057ba9991e7cb18487b0ba444835dd44975aa94b7b2 AS runner

WORKDIR /app

COPY --from=builder ./app/dist ./dist
COPY --from=builder ./app/node_modules ./node_modules
COPY --from=builder /root/.cache /root/.cache

COPY package.json ./
COPY package-lock.json ./
COPY LICENSE ./

RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libdbus-glib-1-2 \
    libxt6 \
    libxrender1 \
    libasound2 \
    libnss3 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libdrm2 \
    libgbm1 \
    libpangocairo-1.0-0 \
    libdrm-amdgpu1 \
    libdrm-intel1 \
    libdrm-nouveau2 \
    libdrm-radeon1 \
    libgl1 \
    libglvnd0 \
    libglx0 \
    libegl1 \
    && rm -rf /var/lib/apt/lists/*

CMD ["npm", "run", "start:prod"]
