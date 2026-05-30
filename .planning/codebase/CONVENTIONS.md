# Conventions: WhatsApp AI Sales SaaS

**Last updated:** 2026-05-30

## Code Style

- **Language:** TypeScript throughout (no plain JS files)
- **Formatting:** No explicit formatter config (prettier/eslint absent from package.json)
- **Linting:** `tsc --noEmit` via `npm run lint` (type checking only)
- **Quotes:** Mixed usage — single quotes in imports, double quotes in JSX attributes and strings requiring interpolation
- **Semicolons:** Required (standard TypeScript)
- **Indentation:** 2 spaces
- **Line endings:** LF

## Imports

- **Order:** External libs first, then local imports, separated by blank line
- **Path style:** Relative imports with `.js` extension for ESM compatibility
- **Alias:** `@/` maps to `./src/` (via Vite resolve alias + tsconfig paths)

```typescript
import "dotenv/config";
import express from "express";
import { dbService } from "./backend/services/dbService.js";
import { SalesState, Product } from "../../src/types.js";
```

## Error Handling

- **API routes:** try/catch wrapping every handler, returning `res.status(500).json({ error: error.message })`
- **Service layer:** Errors propagate to API handler; some services catch and log warnings
- **Database:** Connection error detection in `dbService.ts` with retry on specific error codes
- **WhatsApp:** Retry logic in `sendWhatsAppMessage` with fallback delivery method
- **AI:** Timeout wrapper (30s) around Gemini API calls

## State Management

- **Frontend:** All state in React component state (useState/useEffect) — no Redux, Zustand, or Context
- **Auth:** localStorage tokens + Axios interceptor for 401 handling
- **Config persistence:** localStorage for theme, active tab, auth state

## API Patterns

- **RESTful** conventions with `/api/{resource}` paths
- **Auth:** JWT Bearer token in `Authorization` header, plus `x-admin-id` header fallback
- **Multi-tenant:** Admin ID extracted via `getAdminId(req)` helper
- **Response format:** `{ success: true, data }` or `{ error: "message" }`
- **Pagination:** Query params `?page=1&limit=20`

## Frontend Patterns

- **Components:** Function components with hooks (no class components)
- **Lazy loading:** All tab components loaded via `React.lazy()` + `Suspense`
- **Animations:** `motion` library (framer-motion) for sidebar, transitions, micro-interactions
- **Styling:** Tailwind CSS utility classes directly in JSX — no separate CSS files
- **Icons:** Lucide React for all icons
- **Responsive:** Not fully responsive (desktop-first with sidebar layout)

## Database Patterns

- **Prisma ORM** with PostgreSQL adapter
- **Model IDs:** Composite primary keys for Session (`[adminId, id]`) and Order (`[adminId, id]`)
- **JSON columns:** Used for flexible metadata (`metadata`, `paymentConfig`, `reEngagement`, `subscription`)
- **Arrays:** PostgreSQL native arrays for `features`, `images`, `videos`, `productIds`

## Security

- **Passwords:** bcryptjs hashing with salt
- **JWT:** Standard `jsonwebtoken` for stateless auth
- **OTP:** Time-limited email-based OTP verification
- **Sensitive config:** `.env` file for secrets, `.env.example` as template without real values
- **File upload:** MIME type validation (images/videos only), 50MB limit
