#!/bin/bash
#
# Load environment variables from root .env file and export as TF_VAR_* variables
# Usage: source load-env.sh
#

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env file exists in parent directory
ENV_FILE="../.env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
    echo "Please create a .env file in the project root directory."
    return 1 2>/dev/null || exit 1
fi

echo -e "${GREEN}Loading environment variables from $ENV_FILE...${NC}"

# Load .env file (handles multi-line values)
set -a
source "$ENV_FILE"
set +a

# Export Terraform variables from .env values
export TF_VAR_google_client_id="$GOOGLE_CLIENT_ID"
export TF_VAR_google_client_secret="$GOOGLE_CLIENT_SECRET"
export TF_VAR_session_secret="$SESSION_SECRET"
export TF_VAR_jwt_public_key_prod="$JWT_PUBLIC_KEY_PROD"
export TF_VAR_jwt_public_key_dev="$JWT_PUBLIC_KEY_DEV"
export TF_VAR_jwt_private_key_dev="$JWT_PRIVATE_KEY_DEV"
export TF_VAR_node_env="${NODE_ENV:-production}"

# Optional: Set GCP project ID if not already set
# export TF_VAR_project_id="modsecurity-demo"

# Verify required variables are set
MISSING_VARS=()

if [ -z "$TF_VAR_google_client_id" ]; then
    MISSING_VARS+=("GOOGLE_CLIENT_ID")
fi

if [ -z "$TF_VAR_google_client_secret" ]; then
    MISSING_VARS+=("GOOGLE_CLIENT_SECRET")
fi

if [ -z "$TF_VAR_session_secret" ]; then
    MISSING_VARS+=("SESSION_SECRET")
fi

if [ -z "$TF_VAR_jwt_public_key_prod" ]; then
    MISSING_VARS+=("JWT_PUBLIC_KEY_PROD")
fi

# Report status
if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Warning: The following variables are not set in .env:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "  ${YELLOW}- $var${NC}"
    done
    echo ""
    echo "These variables are required for deployment."
    return 1 2>/dev/null || exit 1
fi

echo -e "${GREEN}✓ Environment variables loaded successfully!${NC}"
echo ""
echo "Terraform variables set:"
echo "  - TF_VAR_google_client_id (from GOOGLE_CLIENT_ID)"
echo "  - TF_VAR_google_client_secret (from GOOGLE_CLIENT_SECRET)"
echo "  - TF_VAR_session_secret (from SESSION_SECRET)"
echo "  - TF_VAR_jwt_public_key_prod (from JWT_PUBLIC_KEY_PROD)"
echo "  - TF_VAR_jwt_public_key_dev (from JWT_PUBLIC_KEY_DEV)"
echo "  - TF_VAR_jwt_private_key_dev (from JWT_PRIVATE_KEY_DEV)"
echo "  - TF_VAR_node_env (from NODE_ENV, default: production)"
echo ""
echo -e "${GREEN}You can now run:${NC}"
echo "  terraform plan"
echo "  terraform apply"
echo ""
echo -e "${YELLOW}Note: You still need to set TF_VAR_project_id if not using default${NC}"
echo "  export TF_VAR_project_id=\"your-gcp-project-id\""
echo ""

