# Home Telegram Bot

This is a Telegram Bot for a home environment based on MQTT.

The goal of this project is to suit my personal needs.
Currently it's only made for read-only reading of numeric values.

## Features

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
* Start the bot with `npm start`. The bot will stop and tell you, it created a `config.json`. Adapt it to your needs. See [Config](#config).
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
  "telegramUserAllowlist": []
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

### Telegram User Allowlist

The userids of telegram users have to be specified in here.
Everyone can use the bot when it is empty.
You can add a random number, start the bot and write to the bot to find out your own id.
