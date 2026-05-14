FROM docker.io/library/alpine:3.23 AS packages
RUN apk upgrade --no-cache \
	&& apk add --no-cache npm
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --no-update-notifier --omit=dev


FROM docker.io/library/alpine:3.23 AS final
RUN apk upgrade --no-cache \
	&& apk add --no-cache nodejs \
	&& addgroup -g 1234 runner \
	&& adduser -D -u 1234 -G runner runner \
	&& rm -f -- /etc/*-

ENV NODE_ENV=production
WORKDIR /app
VOLUME /app/persist

COPY package.json ./
COPY --from=packages /build/node_modules ./node_modules
COPY source ./

USER runner
ENTRYPOINT ["node", "--enable-source-maps"]
CMD ["home-telegram-bot.ts"]
