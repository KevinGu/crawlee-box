pm2 start "pnpm start:prod" --name crawlee-box --log /data/node-logs/crawlee-box.log
sudo systemctl restart nginx