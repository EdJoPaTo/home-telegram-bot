# Home Telegram Bot

[![Dependency Status](https://david-dm.org/edjopato/home-telegram-bot/status.svg)](https://david-dm.org/edjopato/home-telegram-bot)
[![Dependency Status](https://david-dm.org/edjopato/home-telegram-bot/dev-status.svg)](https://david-dm.org/edjopato/home-telegram-bot?type=dev)
[![mqtt-smarthome](https://img.shields.io/badge/mqtt-smarthome-blue.svg)](https://github.com/mqtt-smarthome/mqtt-smarthome)

This is a Telegram Bot for a home environment based on [mqtt-smarthome](https://github.com/mqtt-smarthome/mqtt-smarthome).
Currently it's only made for read-only reading of numeric values.

## Features

### Graph

Users can plot dynamic graphs of the history sensor values.
Plotting is made with [d3](https://d3js.org/).
As Telegram sadly does not support SVG [Sharp](https://github.com/lovell/sharp/) is used to create images to send via Telegram.

### Notifications

This bot can notify about numeric changes on topics.
An example could be to be notified about temperature changes or unresponsive devices via a [Connection Status Topic](https://github.com/mqtt-smarthome/mqtt-smarthome/blob/master/Architecture.md#connected-status).

---

# Installation

This was tested on a Raspberry Pi with Raspbian.
NodeJS is already installed.

* Clone this repositiory to a position you like.
* modify `home-telegram-bot.service` to fit your needs
  * `User` and `Group` are propably `pi` and `pi`
  * `WorkingDirectory` is your repositiory directory. Use the full path (see `pwd`).
* Call the `install.sh`
* Start the bot with `npm start`. The bot will stop and tell you, it created a `config.json`. Adapt it to your needs. See <a href="#config">Config</a>.
* When everything is ready start the bot with systemd: `sudo systemctl start home-telegram-bot.service`
  * When the bot shall start on system bootup run: `sudo systemctl enable home-telegram-bot.service`

## Config

On the first start of the bot a config is generated.
Edit it to fit your needs.

```json
{
  "mqttServer": "tcp://localhost:1883",
  "mqttTopics": [
    "+/connected",
    "+/status/#"
  ],
  "name": "home-telegram-bot",
  "telegramBotToken": "123:abc",
  "telegramUserWhitelist": []
}

```

### MQTT Settings

Set MQTT Server and MQTT Topics to be subscribed by the bot.
Wildcards are supported.

### Telegram Bot Token

Go to the [BotFather](https://t.me/botfather) and create your telegram bot account.
He will provide you with a token you have to place in here.

Also give the BotFather the commands the bot shall show.
A list for Copy & Paste is in `botfather-commands.txt`.

### Telegram User Whitelist

The userids of telegram users have to be specified in here.
Everyone can use the bot when it is empty.
You can add a random number, start the bot and write to the bot.
