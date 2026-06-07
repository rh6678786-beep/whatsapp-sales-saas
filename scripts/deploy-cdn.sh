#!/bin/bash
# =============================================================================
# CDN Asset Deployment Script
# Syncs built static assets to S3 and creates CloudFront invalidation.
#
# Usage:
#   ./scripts/deploy-cdn.sh                          # Uses env vars
#   ./scripts/deploy-cdn.sh s3://bucket distribution-id  # Explicit args
#
# Environment variables:
#   CDN_S3_BUCKET        - S3 bucket name (e.g., whatsapp-saas-assets-prod)
#   CDN_DISTRIBUTION_ID  - CloudFront distribution ID
#   CDN_AWS_REGION       - AWS region (default: us-east-1)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"; }

# ---- Validate prerequisites ----
if ! command -v aws &> /dev/null; then
  log_error "AWS CLI not found. Install: pip install awscli"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  log_warn "jq not found. Install for better output formatting."
fi

# ---- Configuration ----
DIST_DIR="${DIST_DIR:-./dist}"
S3_BUCKET="${1:-${CDN_S3_BUCKET:-}}"
DISTRIBUTION_ID="${2:-${CDN_DISTRIBUTION_ID:-}}"
AWS_REGION="${CDN_AWS_REGION:-us-east-1}"

# ---- Validate inputs ----
if [ -z "$S3_BUCKET" ]; then
  log_error "S3 bucket is required. Set CDN_S3_BUCKET env var or pass as arg."
  echo "Usage: $0 [s3-bucket] [cloudfront-distribution-id]"
  exit 1
fi

# Strip s3:// prefix if provided
S3_BUCKET="${S3_BUCKET#s3://}"

if [ ! -d "$DIST_DIR" ]; then
  log_error "Build directory '${DIST_DIR}' not found. Run 'npm run build' first."
  exit 1
fi

# ---- Step 1: Verify AWS credentials ----
log_step "Step 1: Verifying AWS credentials"
if ! aws sts get-caller-identity &>/dev/null; then
  log_error "AWS credentials not configured. Run 'aws configure' first."
  exit 1
fi
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
log_info "Authenticated as AWS account: ${AWS_ACCOUNT}"

# ---- Step 2: Sync assets to S3 ----
log_step "Step 2: Syncing built assets to S3"
ASSET_COUNT=$(find "$DIST_DIR" -type f | wc -l)
log_info "Found ${ASSET_COUNT} files to upload"

# Sync with cache headers:
# - JS/CSS/images: cache for 1 year (immutable, hashed filenames)
# - index.html: NO cache (must always be fresh)
aws s3 sync "$DIST_DIR" "s3://${S3_BUCKET}" \
  --region "$AWS_REGION" \
  --acl private \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --no-progress

aws s3 cp "$DIST_DIR/index.html" "s3://${S3_BUCKET}/index.html" \
  --region "$AWS_REGION" \
  --acl private \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata-directive REPLACE

log_info "S3 sync complete!"

# ---- Step 3: Verify sync ----
log_step "Step 3: Verifying sync"
S3_FILE_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/" --recursive --region "$AWS_REGION" | wc -l)
log_info "Files on S3: ${S3_FILE_COUNT}"

# ---- Step 4: CloudFront invalidation ----
if [ -n "$DISTRIBUTION_ID" ]; then
  log_step "Step 4: Creating CloudFront invalidation"
  log_info "Distribution ID: ${DISTRIBUTION_ID}"

  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text \
    --region "$AWS_REGION")

  log_info "Invalidation created: ${INVALIDATION_ID}"

  # Wait for invalidation to complete (optional)
  log_info "Waiting for invalidation to complete (this may take 2-5 minutes)..."
  aws cloudfront wait invalidation-completed \
    --distribution-id "$DISTRIBUTION_ID" \
    --id "$INVALIDATION_ID" \
    --region "$AWS_REGION"

  log_info "CloudFront invalidation complete!"
else
  log_warn "No CloudFront distribution ID provided. Skipping invalidation."
  log_warn "Static assets are on S3 but CloudFront cache is stale."
  log_warn "Set CDN_DISTRIBUTION_ID or run invalidation manually."
fi

# ---- Summary ----
log_step "Deployment Complete!"
echo ""
echo "  S3 Bucket:       s3://${S3_BUCKET}"
echo "  Files Synced:    ${ASSET_COUNT}"
echo "  CDN Distribution: ${DISTRIBUTION_ID:-Not configured}"
echo ""
echo "  Your assets are now live on the CDN edge network."
echo "  Initial propagation may take 5-10 minutes."
echo ""

if [ -n "$DISTRIBUTION_ID" ]; then
  DIST_DOMAIN=$(aws cloudfront get-distribution \
    --id "$DISTRIBUTION_ID" \
    --query 'Distribution.DomainName' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")
  if [ -n "$DIST_DOMAIN" ]; then
    echo "  CDN URL: https://${DIST_DOMAIN}"
  fi
fi
echo ""
