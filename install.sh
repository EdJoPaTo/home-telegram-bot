#!/bin/bash

npm ci --production

echo
echo WARNING
echo Service will fail when some values are not filled out
echo

# copy stuff
sudo cp -uv *.service /etc/systemd/system

# reload systemd
sudo systemctl daemon-reload

echo Make sure inkscape is installed
