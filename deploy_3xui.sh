#!/bin/bash
ssh -o StrictHostKeyChecking=no -i /Users/mogilevandrei/.gemini/antigravity/scratch/longevity-portal/tg_bot_deploy_key root@204.168.178.83 << 'REMOTE'
apt-get update && apt-get install -y expect
cat << 'EXP' > /tmp/auto.exp
set timeout -1
spawn bash -c "bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)"
expect {
    "Are you sure you want to proceed?" { send "y\r"; exp_continue }
    "customize the Panel Port settings" { send "y\r"; exp_continue }
    "Please set up the panel port" { send "2053\r"; exp_continue }
    "Choose an option" { send "2\r"; exp_continue }
    "leave empty to skip" { send "\r"; exp_continue }
    "default 80" { send "\r"; exp_continue }
    eof
}
EXP
expect /tmp/auto.exp | tee /tmp/xui_install.log
REMOTE
