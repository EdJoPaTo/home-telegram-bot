FROM docker.io/denoland/deno:latest AS builder
RUN apt-get update \
	&& apt-get upgrade -y
WORKDIR /app
COPY . ./
RUN deno compile \
	--allow-env \
	--allow-net \
	--allow-read=persist \
	--allow-write=persist \
	source/home-telegram-bot.ts


FROM docker.io/library/debian:trixie-slim AS final
RUN apt-get update \
	&& apt-get upgrade -y \
	&& apt-get clean \
	&& groupadd --system --gid 923 runner \
	&& useradd --system --uid 923 --gid 923 --create-home runner \
	&& rm -rf /etc/*- /var/lib/apt/lists/* /var/cache/* /var/log/*

WORKDIR /app

COPY --from=builder /app/home-telegram-bot /usr/local/bin/

USER runner
CMD ["home-telegram-bot"]
