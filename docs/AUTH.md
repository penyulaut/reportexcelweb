# Google OAuth Setup Guide

## Overview
Aplikasi menggunakan NextAuth.js v5 (Auth.js) untuk Google OAuth authentication.

## Environment Variables
```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key-min-32-chars
```

## Setup Google OAuth

### 1. Google Cloud Console
1. Buka https://console.cloud.google.com/
2. Buat project baru atau pilih existing project
3. Navigasi ke **APIs & Services** > **Credentials**
4. Klik **Create Credentials** > **OAuth client ID**
5. Pilih **Application type**: Web application
6. **Name**: Ticket Input Web
7. **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-production-url.com/api/auth/callback/google`
8. Klik **Create**
9. Copy **Client ID** dan **Client Secret** ke `.env.local`

### 2. Generate NEXTAUTH_SECRET
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 } | ForEach-Object { [byte]$_ }))

# Atau online: https://generate-secret.vercel.app/32
```

### 3. Update Environment
Copy ke `.env.local`:
```bash
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generated-secret-here
```

## File Structure
```
/src
  auth.ts                    # NextAuth config with Google provider
  middleware.ts              # Route protection
  /app
    /api/auth/[...nextauth]  # API route handler
    /(full-width-pages)/(auth)/signin/page.tsx  # Sign in page
  /components
    /auth
      GoogleSignInButton.tsx # Google sign in button
    /providers
      NextAuthProvider.tsx   # Session provider wrapper
```

## Protected Routes

### Middleware (`src/middleware.ts`)
```typescript
// Protected routes require authentication
const isPublicRoute = 
  pathname === "/" ||
  pathname === "/signin" ||
  pathname === "/error" ||
  pathname.startsWith("/api/");

// All other routes redirect to /signin if not authenticated
```

### Server Components
```typescript
import { auth } from "@/auth";

export default async function ProtectedPage() {
  const session = await auth();
  
  if (!session) {
    return <div>Not authenticated</div>;
  }
  
  return <div>Welcome {session.user.name}</div>;
}
```

### Client Components
```typescript
"use client";
import { useSession } from "next-auth/react";

export function UserInfo() {
  const { data: session, status } = useSession();
  
  if (status === "loading") return <div>Loading...</div>;
  if (status === "unauthenticated") return <div>Not logged in</div>;
  
  return <div>Hello {session.user.name}</div>;
}
```

## Sign Out
```typescript
"use client";
import { signOut } from "next-auth/react";

<button onClick={() => signOut({ callbackUrl: "/signin" })}>
  Sign Out
</button>
```

## Session Data
```typescript
{
  user: {
    id: string;
    name: string;
    email: string;
    image: string;
  },
  accessToken: string,
  expires: string
}
```

## Troubleshooting

### Error: `redirect_uri_mismatch`
- Pastikan redirect URI di Google Console sama dengan `NEXTAUTH_URL`
- Tambahkan `http://localhost:3000/api/auth/callback/google`

### Error: `Invalid client`
- Check `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` di `.env.local`
- Restart dev server setelah update env

### Error: `NEXTAUTH_SECRET` missing
- Generate secret: `openssl rand -base64 32`
- Tambahkan ke `.env.local`

## Production Setup
1. Update **Authorized redirect URIs** di Google Console dengan domain production
2. Set `NEXTAUTH_URL=https://your-domain.com`
3. Set `NEXTAUTH_SECRET` dengan value yang kuat
4. Deploy dan test

## Security Notes
- Jangan commit `.env.local` ke git
- Gunakan `NEXTAUTH_SECRET` yang kuat (min 32 chars)
- Enable HTTPS di production
- Restrict domain di Google OAuth jika diperlukan
