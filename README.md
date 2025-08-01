# Home Telegram Bot

This is a Telegram Bot for a home environment based on MQTT.

The goal of this project is to suit my personal needs.
Currently, it's only made for read-only reading of numeric values.

## Features

### Notifications

This bot can notify about numeric changes on topics.
An example could be to be notified about temperature changes or unresponsive devices via a [Connection Status Topic](https://github.com/mqtt-smarthome/mqtt-smarthome/blob/master/Architecture.md#connected-status).

---

# Installation

This was tested on a Raspberry Pi with Raspberry Pi OS and Podman installed.

Mount a persist folder into the container at `/app/persist`.
Create a config file. See [Config](#config).

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

The user IDs of Telegram users have to be specified in here.
Everyone can use the bot when it is empty.
You can add a random number, start the bot and write to the bot to find out your own id.
