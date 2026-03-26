apt-get update && apt-get install -y expect
cat << 'EXP' > /tmp/auto.exp
set timeout -1
spawn bash -c "bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)"
expect "y/n"
send "y\r"
expect "panel port"
send "2053\r"
expect "default 2 for IP"
send "2\r"
expect "leave empty to skip"
send "\r"
expect "default 80"
send "\r"
expect eof
EXP
expect /tmp/auto.exp
