#!/bin/bash
set -e

nice npm ci --production
nice npm run build

echo
echo WARNING
echo Service will fail when some values are not filled out
echo

# systemd
sudo cp -uv *.service /etc/systemd/system
sudo systemctl daemon-reload

# start
sudo systemctl restart home-telegram-bot.service
sudo systemctl enable home-telegram-bot.service
