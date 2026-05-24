import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], // Kosong di Edge, akan ditambahkan di auth.ts pada runtime server
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
        session.user.id = token.id;
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
    maxAge: 30 * 24 * 60 * 60, // 30 hari
  },
  debug: process.env.NODE_ENV === "development",
} satisfies NextAuthConfig;
