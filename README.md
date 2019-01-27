# Home Telegram Bot

[![Build Status](https://travis-ci.org/EdJoPaTo/home-telegram-bot.svg?branch=master)](https://travis-ci.org/EdJoPaTo/home-telegram-bot)
[![Dependency Status](https://david-dm.org/edjopato/home-telegram-bot/status.svg)](https://david-dm.org/edjopato/home-telegram-bot)
[![Dependency Status](https://david-dm.org/edjopato/home-telegram-bot/dev-status.svg)](https://david-dm.org/edjopato/home-telegram-bot?type=dev)

This is a Telegram Bot for a home environment based on [mqtt-smarthome](https://github.com/mqtt-smarthome/mqtt-smarthome).
Currently it's only made for read only reading of numeric values.

As Telegram Bot Framework [telegraf](https://github.com/telegraf/telegraf) is used.

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
  "telegramBotToken": "123:abc",
  "telegramUserWhitelist": []
}

```

### MQTT Settings

Set MQTT Server and MQTT Topics to be subscribed by the bot.
Wildcards are supported.

### Telegram Bot Token

Go to the [BotFather](https://t.me/botfather) and create your telegram bot account.
He will provide you with a token you have to place in here

### Telegram User Whitelist

The userids of telegram users have to be specified in here.
Everyone can use the bot when it is empty.
You can add a random number, start the bot and write to the bot.

## Notifications

This bot can notify about temperature changing.
When the temperature of the (currently there is only one possible) outdoor sensor gets higher or lower than an indoor sensor the specific user gets notified.

## Graph

Users can plot dynamic graphs of the history sensor values.
Plotting is made with [gnuplot](http://gnuplot.info/)
