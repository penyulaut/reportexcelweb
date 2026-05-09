import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import bcrypt from "bcryptjs";
import { getAccountByUsername } from "@/lib/turso";

// Extend the session type
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      username?: string | null;
    };
  }
}

// Extend the JWT type
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          // Find account by username in DB
          const user = await getAccountByUsername(credentials.username as string);
          
          if (!user) {
            return null; // User not found
          }

          // Check password
          let passwordsMatch = false;
          try {
            passwordsMatch = await bcrypt.compare(
              credentials.password as string,
              user.password as string
            );
          } catch {
            passwordsMatch = false;
          }

          const plainMatch = credentials.password === (user.password as string);

          if (passwordsMatch || plainMatch) {
            return {
              id: user.id?.toString() as string,
              name: user.name as string,
              username: user.name as string,
            };
          }
        } catch (error) {
          console.error("Auth error:", error);
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // session.user.id = token.id;
        session.user.username = token.username;
        session.user.name = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === "development",
});
