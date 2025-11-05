#!/bin/bash
#
# Startup script for websec application on GCP Compute Engine
# This script runs on first boot and sets up the Docker Compose application
#
# Container-Optimized OS (COS) notes:
# - Docker is pre-installed, but Docker Compose must be installed manually
# - Root filesystem is read-only
# - Most mount points have noexec flag (including /home, /var, /mnt/stateful_partition, /tmp)
# - /var/lib/toolbox is the only writable location that allows execution
# - Docker needs DOCKER_CONFIG set to a writable location (not /root/.docker)
#

set -e  # Exit on error
set -x  # Print commands (for debugging via serial console)

# Log all output to a file for debugging
exec > >(tee -a /var/log/startup-script.log)
exec 2>&1

echo "=========================================="
echo "Starting websec deployment script"
echo "Time: $(date)"
echo "=========================================="

# Configuration from Terraform template variables
REPO_URL="${repo_url}"
REPO_BRANCH="${repo_branch}"
GOOGLE_CLIENT_ID="${google_client_id}"
GOOGLE_CLIENT_SECRET="${google_client_secret}"
SESSION_SECRET="${session_secret}"
JWT_PUBLIC_KEY_PROD="${jwt_public_key_prod}"
JWT_PUBLIC_KEY_DEV="${jwt_public_key_dev}"
JWT_PRIVATE_KEY_DEV="${jwt_private_key_dev}"
NODE_ENV="${node_env}"

# Get the public IP address of this instance
PUBLIC_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)
echo "Public IP: $PUBLIC_IP"

# Application directory (COS uses /home/chronos for user data)
APP_DIR="/home/chronos/websec"

# Create application directory
echo "Creating application directory: $APP_DIR"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Install git if not present (COS has git, but check anyway)
if ! command -v git &> /dev/null; then
    echo "Installing git..."
    # COS doesn't support apt-get, but git should be pre-installed
    echo "ERROR: git not found and cannot be installed on COS"
    exit 1
fi

# Clone the repository
echo "Cloning repository: $REPO_URL (branch: $REPO_BRANCH)"
if [ -d "$APP_DIR/.git" ]; then
    echo "Repository already exists, pulling latest changes..."
    cd "$APP_DIR"
    git pull origin "$REPO_BRANCH"
else
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Create .env file with production configuration
echo "Creating .env file with production configuration..."
cat > "$APP_DIR/.env" <<EOF
# Google OAuth Configuration
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=http://$PUBLIC_IP.nip.io:8888/auth/google/callback

# Session Secret
SESSION_SECRET=$SESSION_SECRET

# JWT Signature Verification Keys (ES256 - ECDSA P-256)
JWT_PUBLIC_KEY_PROD="$JWT_PUBLIC_KEY_PROD"

JWT_PUBLIC_KEY_DEV="$JWT_PUBLIC_KEY_DEV"

JWT_PRIVATE_KEY_DEV="$JWT_PRIVATE_KEY_DEV"

# Environment
NODE_ENV=$NODE_ENV
EOF

echo ".env file created successfully"

# Verify Docker is installed
echo "Verifying Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker not found. This should not happen on Container-Optimized OS."
    exit 1
fi

docker --version

# Install Docker Compose to /var/lib/toolbox/bin (only executable location on COS)
echo "Installing Docker Compose..."
DOCKER_COMPOSE_VERSION=v2.24.0
DOCKER_COMPOSE_PATH=/var/lib/toolbox/bin/docker-compose

# Create directory if it doesn't exist
sudo mkdir -p /var/lib/toolbox/bin
sudo chmod 755 /var/lib/toolbox/bin

# Download Docker Compose if not already present
if [ ! -f "$DOCKER_COMPOSE_PATH" ]; then
    echo "Downloading Docker Compose $${DOCKER_COMPOSE_VERSION}..."
    sudo curl -SL "https://github.com/docker/compose/releases/download/$${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \
        -o "$DOCKER_COMPOSE_PATH"
    sudo chmod 755 "$DOCKER_COMPOSE_PATH"
    echo "Docker Compose installed successfully"
else
    echo "Docker Compose already installed at $DOCKER_COMPOSE_PATH"
fi

# Verify installation
echo "Verifying Docker Compose installation..."
sudo "$DOCKER_COMPOSE_PATH" version

# Create data directory for SQLite databases (persistent storage)
echo "Creating data directory for SQLite databases..."
mkdir -p "$APP_DIR/app/data"

# Set proper permissions
echo "Setting permissions..."
chmod -R 755 "$APP_DIR"

# Set up Docker Compose command with required environment variables
echo "Setting up Docker Compose environment..."
cd "$APP_DIR"

# COS requires DOCKER_CONFIG to be set to a writable location (root filesystem is read-only)
export DOCKER_CONFIG=/var/lib/docker/config
sudo mkdir -p "$DOCKER_CONFIG"

# Docker Compose command with full path and environment
COMPOSE_CMD="sudo DOCKER_CONFIG=$DOCKER_CONFIG $DOCKER_COMPOSE_PATH"

echo "Using Docker Compose: $DOCKER_COMPOSE_PATH"
echo "Docker config directory: $DOCKER_CONFIG"

# Stop any existing containers
echo "Stopping any existing containers..."
$COMPOSE_CMD down || true

# Build and start services
echo "Building and starting services (this may take 2-3 minutes)..."
$COMPOSE_CMD up --build -d

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 10

# Check container status
echo "Container status:"
$COMPOSE_CMD ps

# Show logs
echo "Recent logs:"
$COMPOSE_CMD logs --tail=50

# Verify the application is responding
echo "Verifying application health..."
sleep 5
if curl -f http://localhost:8888/health &> /dev/null; then
    echo "✅ Application is healthy and responding!"
else
    echo "⚠️  Application health check failed. Check logs with: $COMPOSE_CMD logs"
fi

echo "=========================================="
echo "Deployment complete!"
echo "Time: $(date)"
echo "=========================================="
echo ""
echo "Application URL: http://$PUBLIC_IP:8888"
echo "Google OAuth Callback: http://$PUBLIC_IP:8888/auth/google/callback"
echo ""
echo "⚠️  IMPORTANT: Update your Google OAuth settings with the callback URL above!"
echo "   Go to: https://console.cloud.google.com/apis/credentials"
echo ""
echo "Docker Compose commands (use these to manage the application):"
echo "  View logs:   $COMPOSE_CMD logs -f"
echo "  Restart:     $COMPOSE_CMD restart"
echo "  Stop:        $COMPOSE_CMD down"
echo "  Status:      $COMPOSE_CMD ps"
echo ""
echo "Or create an alias for convenience:"
echo "  alias docker-compose='$COMPOSE_CMD'"
echo ""

