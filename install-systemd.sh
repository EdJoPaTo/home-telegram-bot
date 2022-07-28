#!/usr/bin/env bash
set -e

nice npm ci
rm -rf dist
nice ./node_modules/.bin/tsc

# systemd
sudo cp -v ./*.service /etc/systemd/system
sudo systemctl daemon-reload

# start
sudo systemctl restart home-telegram-bot.service
sudo systemctl enable home-telegram-bot.service
