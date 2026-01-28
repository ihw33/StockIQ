#!/bin/bash
set -e

# Configuration
NAS_HOST="172.30.1.34"
NAS_USER="thomas"
SOURCE_DIR="/Users/m4_macbook/Projects/Stockiq/"
DEST_DIR="/volume1/docker/stockiq/current"
BACKUP_DIR="/volume1/docker/stockiq/backup_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="/volume1/docker/stockiq/logs/deploy.log"

echo "=== Starting Deployment to $NAS_HOST (via Tar Pipe) ==="

# 1. Create backup on NAS
echo "[1/4] Creating backup on NAS..."
ssh -o BatchMode=yes $NAS_USER@$NAS_HOST "mkdir -p $DEST_DIR && if [ -d '$DEST_DIR' ] && [ \"\$(ls -A $DEST_DIR)\" ]; then cp -r '$DEST_DIR' '$BACKUP_DIR'; fi"

# 2. Sync files (Source Code) using Tar Pipe
# Excluding node_modules, .next, .git, and local env files
echo "[2/4] Syncing source code..."
tar -czf - \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude '.env.local' \
    --exclude '.DS_Store' \
    -C "$SOURCE_DIR" . | \
    ssh -o BatchMode=yes $NAS_USER@$NAS_HOST "mkdir -p $DEST_DIR && tar xzf - -C $DEST_DIR"

# 3. Build and Restart on NAS
echo "[3/4] Building and Restarting service on NAS..."
ssh -o BatchMode=yes $NAS_USER@$NAS_HOST "bash -s" << EOF
  set -e
  cd $DEST_DIR

  # Setup logs
  mkdir -p \$(dirname $LOG_FILE)

  echo "Stopping existing services..."
  pkill -f "node.*3000" || true
  docker stop stockiq 2>/dev/null || true
  docker rm stockiq 2>/dev/null || true

  echo "Installing dependencies..."
  npm ci --production

  echo "Building application..."
  # If build fails, we might want to revert? For now, fail hard.
  npm run build

  echo "Starting application..."
  # Use nohup to keep running after disconnect
  nohup npm start > $LOG_FILE 2>&1 &
  
  echo "Waiting for service to start..."
  sleep 10
  
  # Check if running
  if ps aux | grep "node.*stockiq" | grep -v grep > /dev/null; then
    echo "Service is RUNNING."
    # Print first few lines of log to verify
    head -n 20 $LOG_FILE
  else
    echo "Service FAILED to start. Last logs:"
    tail -n 20 $LOG_FILE
    exit 1
  fi
EOF

echo "[4/4] Deployment Complete!"
echo "Check URL: http://$NAS_HOST:3000"
