# Home Telegram Bot

This is a Telegram Bot for a home environment based on [mqtt-smarthome](https://github.com/mqtt-smarthome/mqtt-smarthome).
Currently it's only made for read only and only temperature / humidity sensors.

As Telegram Bot Framework [telegraf](https://github.com/telegraf/telegraf) is used.

## Notifications

This bot can notify about temperature changing.
When the temperature of the (currently there is only one possible) outdoor sensor gets higher or lower than an indoor sensor the specific user gets notified.

## Graph

Users can plot dynamic graphs of the history sensor values.
Plotting is made with [gnuplot](http://gnuplot.info/)
