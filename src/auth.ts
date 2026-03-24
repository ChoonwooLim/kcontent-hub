import NextAuth, { NextAuthConfig } from 'next-auth';
import type { Provider } from "next-auth/providers";
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const providers: Provider[] = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      
      const user = await prisma.user.findUnique({
        where: { email: credentials.email as string }
      });
      
      if (!user || !user.password) return null;
      
      const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password);
      
      if (!isPasswordValid) return null;
      
      return user;
    }
  })
];

export const config: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers,
  secret: process.env.AUTH_SECRET || "kcontent-studio-secret-key-2026-orbitron",
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && typeof token.id === 'string') {
        session.user.id = token.id;
      }
      return session;
    }
  }
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
