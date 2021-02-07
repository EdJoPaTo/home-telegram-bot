#!/bin/bash
set -e

nice npm ci --production

echo
echo WARNING
echo Service will fail when some values are not filled out
echo

# systemd
sudo cp -uv *.service /etc/systemd/system
sudo systemctl daemon-reload

# start
sudo systemctl enable --now home-telegram-bot.service
