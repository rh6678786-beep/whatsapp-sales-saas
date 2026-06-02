# Security Verification Checklist

Use this checklist to verify all security features are working correctly after deployment.

## Quick Start (5 minutes)

```bash
# 1. Verify HTTPS enforcement
curl -i http://localhost:3000/api/health
# Expected: 301 redirect to https://

# 2. Verify HSTS headers
curl -i https://localhost:3000/api/health
# Expected: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

# 3. Verify environment validation
# (Server logs during startup)
# Expected: "Environment validated ✓"

# 4. Get auth token
TOKEN=$(curl -s https://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"test"}' \
  | jq -r '.token')
echo "Token: $TOKEN"
```

---

## Input Validation ✅

### Test: Settings route rejects unknown fields

```bash
curl -X POST https://localhost:3000/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "Valid Field",
    "maliciousField": "This should be rejected"
  }'
```

**Expected:** 
- Status: `400 Bad Request`
- Error: `"maliciousField is not allowed"`

**Actual:**
- Status: ___
- Error: ___

---

## CSRF Protection ✅

### Test 1: GET request returns CSRF token

```bash
RESPONSE=$(curl -s -i https://localhost:3000/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

CSRF=$(echo "$RESPONSE" | grep -i "x-csrf-token:" | cut -d' ' -f2 | tr -d '\r')
echo "CSRF Token: $CSRF"
```

**Expected:** 
- Response contains `x-csrf-token` header with 64-char hex string
- Token format: `[0-9a-f]{64}`

**Actual:**
- Header present: ___
- Token length: ___

### Test 2: POST without CSRF token fails

```bash
curl -X POST https://localhost:3000/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"storeName":"Test"}'
```

**Expected:**
- Status: `403 Forbidden`
- Error: `"CSRF token missing"`

**Actual:**
- Status: ___
- Error: ___

### Test 3: POST with valid CSRF token succeeds

```bash
curl -X POST https://localhost:3000/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"storeName":"Test Store"}'
```

**Expected:**
- Status: `200 OK`
- Response: `{"storeName":"Test Store",...}`
- New token in response header: `x-csrf-token: [new-token]`

**Actual:**
- Status: ___
- Response received: ___
- New token: ___

---

## Data Encryption ✅

### Test 1: API key is encrypted in database

```bash
# Insert an API key via settings
curl -X POST https://localhost:3000/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" \
  -H "Content-Type: application/json" \
  -d '{"geminiApiKey":"test-api-key-12345"}'

# Check database directly (only if you have DB access)
psql $DATABASE_URL -c "SELECT \"geminiApiKey\" FROM \"Admin\" LIMIT 1;"
```

**Expected:**
- Database contains JSON structure: `{"iv":"...","authTag":"...","ciphertext":"..."}`
- NOT plain text: `test-api-key-12345`

**Actual:**
- Stored value: ___
- Is encrypted: ___

### Test 2: API key is decrypted when retrieved

```bash
curl -s https://localhost:3000/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.geminiApiKey'
```

**Expected:**
- Response: `"test-api-key-12345"` (decrypted plain text)

**Actual:**
- Response: ___

---

## File Upload Validation ✅

### Test 1: Valid image upload succeeds

```bash
# Create a test image
echo -e '\xFF\xD8\xFF' > test.jpg  # JPEG header
dd if=/dev/zero bs=1K count=1 >> test.jpg  # Add dummy content

curl -F "files=@test.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" \
  https://localhost:3000/api/upload
```

**Expected:**
- Status: `200 OK`
- Response: `{"urls":["https://localhost:3000/uploads/[uuid].jpg"]}`

**Actual:**
- Status: ___
- URL: ___

### Test 2: Executable file rejected

```bash
# Create a fake executable
echo "#!/bin/bash" > malware.sh
chmod +x malware.sh

curl -F "files=@malware.sh" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" \
  https://localhost:3000/api/upload
```

**Expected:**
- Status: `400 Bad Request`
- Error: `"File type not allowed"`

**Actual:**
- Status: ___
- Error: ___

### Test 3: Oversized file rejected

```bash
# Create 50MB file
dd if=/dev/zero of=huge.jpg bs=1M count=50

curl -F "files=@huge.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" \
  https://localhost:3000/api/upload
```

**Expected:**
- Status: `400 Bad Request`
- Error: `"File too large"` or `"exceeded limit"`

**Actual:**
- Status: ___
- Error: ___

### Test 4: File with wrong extension rejected

```bash
# Create PNG header but .jpg extension
echo -e '\x89\x50\x4E\x47' > fake.jpg
dd if=/dev/zero bs=1K count=1 >> fake.jpg

curl -F "files=@fake.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" \
  https://localhost:3000/api/upload
```

**Expected:**
- Status: `400 Bad Request` (magic byte mismatch)
- Error: `"File content doesn't match MIME type"`

**Actual:**
- Status: ___
- Error: ___

---

## Password Recovery ✅

### Test 1: Forgot password endpoint works

```bash
curl -X POST https://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com"}'
```

**Expected:**
- Status: `200 OK`
- Response: `{"message":"Check your email"}`
- Email sent with reset link

**Actual:**
- Status: ___
- Email received: ___

### Test 2: Same response for non-existent email

```bash
curl -X POST https://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com"}'
```

**Expected:**
- Status: `200 OK` (same as valid email)
- Response: `{"message":"Check your email"}` (no enumeration)

**Actual:**
- Status: ___
- Response: ___

### Test 3: Reset password with token works

```bash
# In a real scenario, get token from email link
RESET_TOKEN="[token-from-email]"

curl -X POST https://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{
    \"token\":\"$RESET_TOKEN\",
    \"newPassword\":\"NewPassword123!\"
  }"
```

**Expected:**
- Status: `200 OK`
- Response: `{"success":true}`
- Can login with new password

**Actual:**
- Status: ___
- Login successful: ___

---

## Rate Limiting ✅

### Test: 100 requests per hour limit

```bash
# Send 101 requests quickly
for i in {1..101}; do
  curl -s https://localhost:3000/api/health \
    -H "Authorization: Bearer $TOKEN" > /dev/null
done
```

**Expected:**
- Requests 1-100: `200 OK`
- Request 101+: `429 Too Many Requests`

**Actual:**
- Last successful request: ___
- First rejected request: ___
- Status code: ___

---

## Environment Validation ✅

### Test: Server validates environment on startup

```bash
# Check server logs during startup
docker-compose logs app | grep -i "environment\|validat\|secret"
```

**Expected Output Includes:**
- ✅ `Environment validated`
- ✅ `JWT_SECRET: ••••••••` (masked)
- ✅ `ENCRYPTION_KEY: ••••••••` (masked)
- ✅ `Database connection verified`

**Actual:**
- Startup successful: ___
- All validations passed: ___

---

## HTTPS & HSTS ✅

### Test 1: HTTP redirects to HTTPS

```bash
curl -i http://localhost:3000/api/health
```

**Expected:**
- Status: `301 Moved Permanently`
- Location header: `https://localhost:3000/api/health`

**Actual:**
- Status: ___
- Redirect to: ___

### Test 2: HSTS header present

```bash
curl -i https://localhost:3000/api/health | grep -i "strict-transport-security"
```

**Expected:**
- Header: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

**Actual:**
- Header: ___

---

## Logging ✅

### Test: Audit logs contain correlation IDs

```bash
# Make a request
curl -s https://localhost:3000/api/settings \
  -H "Authorization: Bearer $TOKEN" > /dev/null

# Check logs
docker-compose logs app | grep -i "correlation\|audit" | tail -5
```

**Expected:**
- Logs contain `x-correlation-id: [uuid]`
- Logs in JSON format
- Admin actions logged with timestamps

**Actual:**
- Correlation ID present: ___
- JSON format: ___
- Admin action logged: ___

---

## Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Input Validation | ☐ ✓ ☐ ✗ | |
| CSRF Protection | ☐ ✓ ☐ ✗ | |
| Data Encryption | ☐ ✓ ☐ ✗ | |
| File Upload Validation | ☐ ✓ ☐ ✗ | |
| Password Recovery | ☐ ✓ ☐ ✗ | |
| Rate Limiting | ☐ ✓ ☐ ✗ | |
| Environment Validation | ☐ ✓ ☐ ✗ | |
| HTTPS & HSTS | ☐ ✓ ☐ ✗ | |
| Logging | ☐ ✓ ☐ ✗ | |

**Overall Status:** ☐ Production Ready ☐ Needs Fixes

**Issues Found:**
1. ___
2. ___
3. ___

**Sign-off:**
- Verified by: ___
- Date: ___
- Environment: ___
