#!/bin/zsh
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "Starting Twitch Pill Generator..."
echo "(leave this window open while you use it - closing it stops the app)"
echo ""

( sleep 3 && open "http://localhost:4321" ) &

npm run server
