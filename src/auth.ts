import NextAuth, { NextAuthConfig } from 'next-auth';
import type { Provider } from "next-auth/providers";
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { isBootstrapAdmin } from '@/lib/admin-emails';

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
      if (user.disabled) return null;                      // 관리자가 비활성화한 계정

      const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password);
      if (!isPasswordValid) return null;

      // 로그인 시각 기록 + 부트스트랩 관리자 이메일은 자동 승격 (ADMIN · VIP)
      const promote = isBootstrapAdmin(user.email) && (user.role !== "ADMIN" || user.plan !== "VIP");
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), ...(promote ? { role: "ADMIN", plan: "VIP" } : {}) },
        });
      } catch { /* 기록 실패는 로그인에 영향 없음 */ }

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
      // 관리자가 등급·역할·비활성화를 바꾸면 재로그인 없이 반영되도록 매 요청 DB 에서 갱신
      if (typeof token.id === 'string') {
        try {
          const u = await prisma.user.findUnique({
            where: { id: token.id },
            select: { role: true, plan: true, disabled: true },
          });
          if (!u) {
            token.disabled = true;      // 삭제된 계정
          } else {
            token.role = u.role;
            token.plan = u.plan;
            token.disabled = u.disabled;
          }
        } catch { /* DB 일시 장애 → 기존 토큰 값 유지 */ }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && typeof token.id === 'string') {
        session.user.id = token.id;
      }
      session.user.role = (token.role as "USER" | "ADMIN" | undefined) ?? "USER";
      session.user.plan = (token.plan as "FREE" | "VIP" | undefined) ?? "FREE";
      session.user.disabled = token.disabled === true;
      return session;
    }
  }
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
