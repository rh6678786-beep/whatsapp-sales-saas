# Security Features Implementation Guide

This document explains the new security features added to the project and how to use them.

---

## 1. CSRF Protection 🛡️

**What:** Cross-Site Request Forgery (CSRF) protection prevents attacks where malicious sites trick your browser into making unwanted requests.

**How it works:**
1. Server generates a unique token for each user session
2. Token must be included in state-changing requests (POST, PUT, PATCH, DELETE)
3. Server validates token before processing request
4. Token is single-use (consumed after validation)

### Backend Implementation

The CSRF middleware is already enabled in `server.ts`:

```typescript
// Applied to all routes except webhooks and health checks
app.use((req, res, next) => {
  if (req.path === "/api/billing/webhook" || req.path === "/api/health") {
    return next();
  }
  csrfProtection(req, res, next);
});
```

### Frontend Implementation

#### 1. Get CSRF Token

For **GET requests**, the server automatically generates and returns a token in the response headers:

```javascript
// Any GET request will return the token
const response = await fetch('https://yourapp.com/api/settings', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${token}`,
  }
});

// Token is in response headers
const csrfToken = response.headers.get('X-CSRF-Token');
localStorage.setItem('csrfToken', csrfToken);
```

#### 2. Use CSRF Token in State-Changing Requests

For **POST, PUT, PATCH, DELETE requests**, include the token:

```javascript
// Method 1: In request header (Recommended for SPAs)
const csrfToken = localStorage.getItem('csrfToken');

await fetch('https://yourapp.com/api/settings', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-CSRF-Token': csrfToken,  // ← CSRF token in header
  },
  body: JSON.stringify({
    storeName: 'My Store',
    // ... other data
  })
});
```

```javascript
// Method 2: In form data (for form submissions)
const formData = new FormData();
formData.append('storeName', 'My Store');
formData.append('_csrf', csrfToken);  // ← CSRF token in form

await fetch('https://yourapp.com/api/settings', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
});
```

#### 3. React Hook Example

```typescript
// hooks/useCsrf.ts
import { useEffect, useState } from 'react';

export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState<string>('');

  useEffect(() => {
    // Get token from GET request
    fetch('/api/settings', {
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      }
    })
      .then(res => {
        const token = res.headers.get('X-CSRF-Token');
        if (token) {
          setCsrfToken(token);
          localStorage.setItem('csrfToken', token);
        }
        return res.json();
      });
  }, []);

  return csrfToken;
}

// Usage in component
function SettingsForm() {
  const csrfToken = useCsrf();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const response = await fetch('/api/settings', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        storeName: 'New Name'
      })
    });

    if (response.ok) {
      // Get new token for next request
      const newToken = response.headers.get('X-CSRF-Token');
      if (newToken) {
        localStorage.setItem('csrfToken', newToken);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

---

## 2. File Upload Validation 📁

**What:** Validates uploaded files to prevent:
- Malicious file types (executables, scripts)
- Oversized files
- File type spoofing
- Directory traversal attacks

**Restrictions:**
- **Max file size:** 10 MB (configurable)
- **Allowed types:** JPEG, PNG, WebP, GIF, MP4, MOV, PDF
- **Dangerous extensions:** Automatically rejected (exe, bat, sh, php, etc.)

### Backend Implementation

File validation is already implemented in the upload route:

```typescript
// backend/routes/upload.ts

const ALLOWED_MIMES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm",
  "application/pdf",
];

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

// Multer configuration
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

// Magic byte validation
function validateFileContent(filePath: string, mimetype: string): boolean {
  const FILE_SIGNATURES: Record<string, { offset: number; bytes: number[] }[]> = {
    "image/jpeg": [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }],
    "image/png": [{ offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] }],
    // ... more signatures
  };
  
  // Verify file actually is what it claims to be
  const sigs = FILE_SIGNATURES[mimetype];
  // ... validation logic
}
```

### Frontend Implementation

```typescript
// React component for file upload
import React, { useState } from 'react';

function FileUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Validate on client side first
    const file = files[0];
    
    // Check file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setError(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`);
      return;
    }

    // Check file size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum: 10MB');
      return;
    }

    // Upload
    setUploading(true);
    const formData = new FormData();
    formData.append('files', file);
    formData.append('_csrf', localStorage.getItem('csrfToken') || '');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error);
        return;
      }

      const result = await response.json();
      console.log('Upload successful:', result.urls);
    } catch (err) {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        onChange={handleFileChange}
        accept="image/*,video/mp4"
      />
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {uploading && <div>Uploading...</div>}
    </div>
  );
}

export default FileUpload;
```

---

## 3. Data Encryption at Rest 🔐

**What:** Encrypts sensitive data (API keys, passwords) when stored in the database using AES-256-GCM encryption.

**How it works:**
1. Data is encrypted before storing in database
2. Master key stored in `ENCRYPTION_KEY` environment variable
3. Each encrypted value includes IV (initialization vector), auth tag, and ciphertext
4. Data is decrypted on retrieval

### Environment Setup

```bash
# Generate encryption key (32 bytes)
openssl rand -base64 32

# Add to .env file
ENCRYPTION_KEY=your-generated-base64-key-here
```

### Backend Usage

```typescript
import { encrypt, decrypt } from './backend/lib/encryption.js';

// Encrypt API key before storing
const apiKey = 'my-secret-gemini-key';
const encrypted = encrypt(apiKey);
// Store encrypted value in database

// Decrypt when needed
const decrypted = decrypt(encrypted);
// Use decrypted value
```

### Example: Encrypting API Keys

```typescript
// In dbService.ts
import { encrypt, decrypt } from '../lib/encryption.js';

async updateSettings(adminId: string, settings: any) {
  // Encrypt sensitive fields
  if (settings.geminiApiKey) {
    settings.geminiApiKey = encrypt(settings.geminiApiKey);
  }
  
  if (settings.stripeSecretKey) {
    settings.stripeSecretKey = encrypt(settings.stripeSecretKey);
  }

  // Store encrypted values
  return await prisma.admin.update({
    where: { adminId },
    data: settings
  });
}

async getSettings(adminId: string) {
  const admin = await prisma.admin.findUnique({
    where: { adminId }
  });

  // Decrypt sensitive fields before returning
  if (admin?.geminiApiKey) {
    admin.geminiApiKey = decrypt(admin.geminiApiKey);
  }

  return admin;
}
```

### Never Log Sensitive Data

```typescript
// ❌ WRONG - logs decrypted key
console.log('API Key:', apiKey);

// ✅ CORRECT - logs masked value
import { maskEncryptedValue } from './encryption.js';
console.log('API Key:', maskEncryptedValue(encryptedValue));
// Output: API Key: ***abcd
```

---

## 4. Security Best Practices Checklist

### Development
- [ ] Use generated encryption keys, never hardcode
- [ ] Test CSRF token validation with different sessions
- [ ] Test file upload with various file types
- [ ] Verify encrypted data persists correctly

### Deployment
- [ ] Store `ENCRYPTION_KEY` in Secret Manager (not in .env)
- [ ] Rotate encryption key only if compromised (renders old data inaccessible)
- [ ] Monitor file upload activity for abuse
- [ ] Log CSRF token validation failures

### Monitoring
```bash
# Watch for CSRF failures
docker-compose logs app | grep "CSRF"

# Watch for file upload failures
docker-compose logs app | grep "File validation failed"

# Watch for encryption errors
docker-compose logs app | grep "Encryption"
```

---

## Testing Security Features

### Test CSRF Protection

```bash
# 1. Get CSRF token
curl -i https://yourapp.com/api/settings \
  -H "Authorization: Bearer $TOKEN" | grep -i "x-csrf-token"

# 2. Use token in POST request
curl -X POST https://yourapp.com/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"storeName":"New Name"}'

# 3. Fail without token
curl -X POST https://yourapp.com/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"storeName":"New Name"}'
# Should return: 403 CSRF token missing
```

### Test File Upload Validation

```bash
# 1. Valid file upload
curl -F "files=@image.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  https://yourapp.com/api/upload

# 2. Invalid file type
curl -F "files=@malware.exe" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  https://yourapp.com/api/upload
# Should return: 400 File type not allowed

# 3. Oversized file
curl -F "files=@huge-file-500mb.jpg" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  https://yourapp.com/api/upload
# Should return: 400 File too large
```

### Test Encryption

```bash
# In Node.js console
const { encrypt, decrypt } = await import('./backend/lib/encryption.js');
const secret = "my-secret-api-key";
const encrypted = encrypt(secret);
console.log("Encrypted:", encrypted);
const decrypted = decrypt(encrypted);
console.log("Decrypted:", decrypted);
console.log("Match:", secret === decrypted); // true
```

---

## Troubleshooting

### CSRF Token Issues
```
Error: CSRF token missing
→ Make sure to include X-CSRF-Token header in all state-changing requests

Error: CSRF token invalid or expired
→ Get a new token by making a GET request first
→ Check that token hasn't been used (single-use)
```

### File Upload Issues
```
Error: File type not allowed
→ Check ALLOWED_MIMES list in upload.ts
→ Verify file has correct MIME type

Error: File too large
→ Check MAX_SIZE limit (default 50MB)
→ Split large files before uploading
```

### Encryption Issues
```
Error: ENCRYPTION_KEY environment variable not set
→ Generate key: openssl rand -base64 32
→ Add to .env file

Error: Invalid encrypted string format
→ Don't manually modify encrypted values
→ Use decrypt() to retrieve original value
```

---

**All security features are now active and protecting your application! 🎉**
