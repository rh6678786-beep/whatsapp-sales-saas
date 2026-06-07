# CDN Deployment Guide — CloudFront for Static Assets

## Why CDN?

Without CDN, all static assets (JS, CSS, fonts, images) are served directly from your VPS/server. This means:

- **Slow page loads** for customers far from your server
- **Higher server load** — every asset request consumes CPU/memory
- **No edge caching** — same assets fetched repeatedly

With CloudFront CDN:

- Assets are cached at **400+ edge locations worldwide**
- Page loads **2-5x faster** for global customers
- **Server load reduced** by 60-80% for static assets
- **DDoS protection** via AWS Shield

---

## Architecture

```
User Browser
     │
     ├── https://d12345.cloudfront.net/assets/index-abc123.js  →  CloudFront Edge
     │                                                                   │
     │                                                          ┌────────┴────────┐
     │                                                          │ S3 Bucket (origin)│
     │                                                          │ whatsapp-saas-   │
     │                                                          │ assets-prod       │
     │                                                          └─────────────────┘
     │
     └── https://your-domain.com/api/*  →  Your VPS (unchanged)
```

---

## Prerequisites

- [ ] AWS account with billing enabled
- [ ] AWS CLI installed (`pip install awscli` or `apt install awscli`)
- [ ] IAM user/programmatic access keys configured
- [ ] Your domain's DNS managed in Route 53 or accessible

---

## Step 1: Create S3 Bucket

```bash
# Use a globally unique name
BUCKET="whatsapp-saas-assets-prod-$(openssl rand -hex 4)"
echo "Bucket name: $BUCKET"

aws s3 mb "s3://${BUCKET}" --region us-east-1

# Block all public access (CloudFront uses Origin Access Control)
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

---

## Step 2: Build Frontend for CDN

```bash
# Build with CDN base URL
# This makes all asset paths absolute to your CDN domain
CDN_URL="https://d12345.cloudfront.net" npm run build

# Verify: Check that generated HTML uses CDN URLs
grep cloudfront dist/index.html
# Output: <script type="module" crossorigin src="https://d12345.cloudfront.net/assets/index-D3xV9abc.js">
```

> **Important:** After changing `CDN_URL`, you MUST rebuild and redeploy the app server too, because `index.html` is served by the server and needs the correct base URL.

---

## Step 3: Sync to S3

```bash
# Sync built files to S3 (with proper cache headers)
./scripts/deploy-cdn.sh "$BUCKET"
```

Or manually:

```bash
# JS/CSS/images: cache 1 year (hashed filenames = immutable)
aws s3 sync dist/ "s3://${BUCKET}" \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# index.html: NEVER cache (must always be fresh from server)
aws s3 cp dist/index.html "s3://${BUCKET}/index.html" \
  --cache-control "no-cache, no-store, must-revalidate"
```

---

## Step 4: Create CloudFront Distribution

### Option A: AWS Console (Recommended for first setup)

1. Go to **CloudFront → Create Distribution**
2. **Origin settings:**
   - Origin domain: Select your S3 bucket
   - Origin access: **Origin access control settings → Create OAC**
   - Enable **Origin Shield** (us-east-1)
3. **Default cache behavior:**
   - Viewer protocol policy: **Redirect HTTP to HTTPS**
   - Allowed HTTP methods: **GET, HEAD, OPTIONS**
   - Cache key & origin requests: **Legacy cache settings**
     - Headers: **None**
     - Query strings: **None**
     - Cookies: **None**
   - Response headers policy: **CORS-with-preflight-and-SecurityHeadersPolicy**
4. **Settings:**
   - Price class: **Use all edge locations (best performance)**
   - Alternate domain name (CNAME): Optional, leave blank for now
   - SSL certificate: **Default CloudFront certificate**
   - Default root object: **index.html**
   - Standard logging: **Off**
   - Description: `WhatsApp Sales SaaS Static Assets`
5. Click **Create Distribution**

### Option B: AWS CLI

```bash
# Get your bucket's region-origin URL
BUCKET_REGION=$(aws s3api get-bucket-location --bucket "$BUCKET" --query LocationConstraint --output text)
ORIGIN_ID="whatsapp-saas-assets-origin"

# Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config "{
    \"CallerReference\": \"deploy-$(date +%s)\",
    \"Aliases\": {\"Quantity\": 0},
    \"DefaultRootObject\": \"index.html\",
    \"Origins\": {
      \"Quantity\": 1,
      \"Items\": [{
        \"Id\": \"${ORIGIN_ID}\",
        \"DomainName\": \"${BUCKET}.s3.${BUCKET_REGION}.amazonaws.com\",
        \"OriginPath\": \"\",
        \"CustomHeaders\": {\"Quantity\": 0},
        \"S3OriginConfig\": {\"OriginAccessIdentity\": \"\"}
      }]
    },
    \"DefaultCacheBehavior\": {
      \"TargetOriginId\": \"${ORIGIN_ID}\",
      \"ViewerProtocolPolicy\": \"redirect-to-https\",
      \"AllowedMethods\": {
        \"Quantity\": 3,
        \"Items\": [\"GET\", \"HEAD\", \"OPTIONS\"],
        \"CachedMethods\": {\"Quantity\": 3, \"Items\": [\"GET\", \"HEAD\", \"OPTIONS\"]}
      },
      \"CachePolicyId\": \"658327ea-f89d-4fab-a63d-7e88639e58f6\",
      \"Compress\": true
    },
    \"Comment\": \"WhatsApp Sales SaaS Static Assets\",
    \"Enabled\": true,
    \"PriceClass\": \"PriceClass_All\"
  }"
```

---

## Step 5: Update S3 Bucket Policy for CloudFront

After creating the distribution, note the **OAC (Origin Access Control)** ID. Then update bucket policy:

```bash
# Get the OAC ID from your distribution
DIST_ID="E12345EXAMPLE"
OAC_ID=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DistributionConfig.Origins.Items[0].OriginAccessControlId' --output text)

# Create bucket policy allowing only CloudFront
aws s3api put-bucket-policy --bucket "$BUCKET" --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "cloudfront.amazonaws.com"
    },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::'"$BUCKET"'/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::'"$AWS_ACCOUNT"':distribution/'"$DIST_ID"'"
      }
    }
  }]
}'
```

---

## Step 6: Get CloudFront Domain

```bash
DIST_DOMAIN=$(aws cloudfront get-distribution \
  --id "$DIST_ID" \
  --query 'Distribution.DomainName' \
  --output text)

echo "CDN Domain: https://${DIST_DOMAIN}"
```

> Example output: `https://d3lx9v9abc1234.cloudfront.net`

---

## Step 7: Configure App for CDN

Add to your `.env`:

```env
# .env
CDN_URL=https://d3lx9v9abc1234.cloudfront.net
CDN_S3_BUCKET=whatsapp-saas-assets-prod-abc123
CDN_DISTRIBUTION_ID=E12345EXAMPLE
CDN_AWS_REGION=us-east-1
```

Then rebuild and redeploy:

```bash
npm run build       # Vite uses CDN_URL as base for all asset paths
./scripts/deploy-cdn.sh  # Syncs to S3 + invalidates CloudFront
```

---

## Step 8: Verify CDN is Working

Open browser DevTools → **Network tab** and visit your app:

1. **Check asset URLs:** JS/CSS files should load from `https://d3lx9v9abc1234.cloudfront.net/assets/...`
2. **Check cache headers:** Each asset should have `cache-control: public, max-age=31536000, immutable`
3. **Check response headers:** Look for `x-cache: Hit from cloudfront`
4. **Measure performance:** Compare `DOMContentLoaded` time before vs after

```bash
# Quick CLI test
curl -sI https://d3lx9v9abc1234.cloudfront.net/assets/index-abc123.js | grep -i "x-cache\|cache-control"
```

---

## Updating Assets After Code Changes

After any code change, redeploy assets:

```bash
# Full pipeline: build + sync to S3 + invalidate CloudFront
npm run deploy:assets
```

Or step by step:

```bash
# 1. Build with CDN URL
npm run build

# 2. Sync to S3 + invalidate CloudFront
./scripts/deploy-cdn.sh

# 3. Redeploy app server (index.html must be updated)
docker-compose up -d app
```

---

## Troubleshooting

### Assets 404 on CloudFront
```
→ Check S3 bucket permissions (CloudFront OAC)
→ Verify bucket policy allows CloudFront access
→ Run: aws s3 ls s3://$BUCKET/ --recursive | head
```

### Assets not updating after deploy
```
→ CDN cache is TTL = 1 year. Invalidation takes 2-5 minutes.
→ Check: aws cloudfront list-invalidations --distribution-id $DIST_ID
→ Force refresh: Ctrl+Shift+R (hard reload bypasses cache)
```

### CSP errors in console
```
→ Update CDN_URL in CSP directive in server.ts
→ The app automatically adds CDN_URL to script-src, style-src, etc.
→ After changing CDN_URL, rebuild and restart the server
```

### Mixed content (HTTP/HTTPS)
```
→ Ensure CDN_URL starts with https://
→ CloudFront defaults to HTTPS
→ Update: CDN_URL=https://d3lx9v9abc1234.cloudfront.net
```

---

## Costs

| Service | Estimated Cost |
|---------|---------------|
| S3 Storage | ~$0.023/GB/month (typically < $1/month) |
| S3 Requests | ~$0.004/10k requests (negligible) |
| CloudFront | ~$0.085/GB data transfer out (first 1TB: $0.085/GB) |
| CloudFront Requests | ~$0.010/10k HTTP requests |

**Typical monthly cost for this app:** **$2-5/month**

---

## Rollback

If CDN causes issues, disable it by clearing `CDN_URL`:

```bash
# 1. Remove CDN_URL from .env
sed -i '/^CDN_URL=/d' .env

# 2. Rebuild without CDN
npm run build

# 3. Redeploy
docker-compose down && docker-compose up -d
```

This reverts to serving assets directly from the VPS (no CDN).
