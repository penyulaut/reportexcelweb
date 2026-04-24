import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import type { Session, Account, Profile } from "next-auth";

// Extend the session type
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

// Extend the JWT type
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    id?: string;
    email?: string;
    name?: string;
    image?: string;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }: { account: Account | null; profile?: Profile & { email?: string; name?: string; picture?: string } }) {
      // Optional: Restrict to specific domain
      // if (profile?.email?.endsWith("@yourcompany.com")) {
      //   return true;
      // }
      // return false;
      return true;
    },
    async jwt({ token, account, profile }: { token: JWT; account: Account | null; profile?: Profile & { email?: string; name?: string; picture?: string } }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.id = profile.sub ?? undefined;
        token.email = profile.email ?? undefined;
        token.name = profile.name ?? undefined;
        token.image = profile.picture ?? undefined;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.image;
      }
      session.accessToken = token.accessToken;
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
