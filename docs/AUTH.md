# Database Authentication Guide

## Overview
Aplikasi menggunakan NextAuth.js v5 (Auth.js) dengan `CredentialsProvider` yang dipadukan dengan database lokal (Turso/libSQL) dan hashing `bcryptjs`. Semua sistem login pihak ketiga (seperti Google OAuth) telah dihapus untuk membatasi akses aplikasi khusus bagi internal.

## Environment Variables
Pastikan Anda memiliki konfigurasi berikut di `.env` atau `.env.local`:
```bash
# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key-min-32-chars

# Turso Database
TURSO_DATABASE_URL=libsql://your-database-url.turso.io
TURSO_AUTH_TOKEN=your-database-auth-token
```

## Cara Menambahkan User ke Database

Aplikasi ini tidak menyediakan fitur "Sign Up" di UI demi keamanan. Anda perlu memasukkan user langsung ke dalam database.

### 1. Generate Hash Password
Gunakan script pembantu yang sudah tersedia di folder `scripts/` untuk membuat password hash. Buka terminal di dalam proyek, dan jalankan:
```bash
node scripts/hash-password.js <username_anda> <password_anda>
```
**Contoh:**
```bash
node scripts/hash-password.js admin admin123
```
**Output:**
```
Username: admin
Password: admin123
Hash    : $2b$10$iAzP8Syi9bZK6hk8VY2JputOG0Yvk.xQDmo.h6eTv5HrS7agPP0Va

SQL Insert Example:
INSERT INTO users (username, password) VALUES ('admin', '$2b$10$iAzP8Syi9bZK6hk8VY2JputOG0Yvk.xQDmo.h6eTv5HrS7agPP0Va');
```

### 2. Eksekusi SQL Query
Copy hasil output `SQL Insert Example` tersebut dan jalankan query-nya di:
- Dashboard web Turso Anda (Turso Studio/Shell)
- Atau menggunakan Turso CLI lokal jika Anda punya akses:
  `turso db shell your-db-name "INSERT INTO users ..."`

Setelah query berhasil, user tersebut bisa langsung login di halaman `/signin`.

### 3. Cara Menghapus User
Jika Anda ingin menghapus user yang sudah ada, Anda dapat menjalankan query SQL `DELETE` berikut di dashboard Turso atau Turso CLI:
```sql
DELETE FROM users WHERE username = 'nama_user_yang_ingin_dihapus';
```
**Contoh:**
```sql
DELETE FROM users WHERE username = 'admin';
```
*Catatan: Pastikan Anda tidak menghapus seluruh user jika masih ingin mengakses halaman dashboard.*

## File Structure
```
/src
  auth.ts                    # NextAuth config with Credentials provider & bcrypt
  middleware.ts              # Route protection (Redirects to /signin)
  /lib
    turso.ts                 # Konfigurasi database & query tabel users
  /app
    /(full-width-pages)/(auth)/signin/page.tsx  # Halaman login
  /components
    /auth
      SignInForm.tsx         # Komponen form username & password
```

## Middleware Protection
Semua halaman akan otomatis terproteksi dan akan mengalihkan user ke halaman `/signin` apabila belum memiliki sesi aktif (kecuali rute asset/publik). Jika Anda membuat halaman baru yang seharusnya publik, Anda bisa memodifikasi array/regex pengecualian di dalam `src/middleware.ts`.

## Sign Out
```typescript
"use client";
import { signOut } from "next-auth/react";

<button onClick={() => signOut({ callbackUrl: "/signin" })}>
  Sign Out
</button>
```

## Troubleshooting

### Error: "Invalid username or password"
- Pastikan username yang diketik sesuai persis dengan yang ada di database.
- Pastikan password yang di-*hash* sudah ter-*generate* menggunakan format bcrypt `10 rounds`. Gunakan script `hash-password.js` yang disediakan untuk menghindari kesalahan salt/round.

### Error: `NEXTAUTH_SECRET` missing
- Generate secret baru: `openssl rand -base64 32` (Linux/Mac) atau gunakan online generator.
- Tambahkan ke `.env` atau `.env.local`
