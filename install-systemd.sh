#!/usr/bin/env bash
set -e

nice npm ci --production
nice npm run build

# systemd
sudo cp -uv ./*.service /etc/systemd/system
sudo systemctl daemon-reload

# start
sudo systemctl restart home-telegram-bot.service
sudo systemctl enable home-telegram-bot.service
