#!/usr/bin/env bash
set -eu

sudo nice podman pull ghcr.io/edjopato/home-telegram-bot:edge

sudo mkdir -p /srv/home-telegram-bot/{persist,sessions}

# systemd
sudo cp -v ./*.service /etc/systemd/system
sudo systemctl daemon-reload

# start
sudo systemctl restart home-telegram-bot.service
sudo systemctl enable home-telegram-bot.service
