#!/bin/bash
set -e
cd /var/www/vireyou-carousel
python3 -m pip install -r requirements.txt --quiet
mkdir -p output
echo "Deployment ready"
