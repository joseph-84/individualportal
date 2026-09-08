"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionToken, verifyPassword, hashPassword, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { requireUser } from "@/lib/guard";

export interface LoginState {
  error?: string;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력하세요." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `로그인 시도 횟수를 초과했습니다. ${mins}분 후 다시 시도하세요.` };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failedCount = user.failedLoginCount + 1;
    const lockedUntil = failedCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: failedCount, lockedUntil },
    });
    if (lockedUntil) {
      return { error: `로그인 시도 횟수를 초과했습니다. ${LOCKOUT_MINUTES}분 후 다시 시도하세요.` };
    }
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const token = await createSessionToken({ sub: user.id, tv: user.tokenVersion });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

export async function changeOwnPasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await requireUser();
  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");

  if (next.length < 8) return { error: "새 비밀번호는 8자 이상이어야 합니다." };
  if (next !== confirm) return { error: "새 비밀번호 확인이 일치하지 않습니다." };

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const valid = await verifyPassword(current, dbUser.passwordHash);
  if (!valid) return { error: "현재 비밀번호가 올바르지 않습니다." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), tokenVersion: { increment: 1 } },
  });

  // tokenVersion bump invalidates the cookie we're currently using — issue a fresh one
  // so the user isn't immediately logged out by their own password change.
  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const token = await createSessionToken({ sub: fresh.id, tv: fresh.tokenVersion });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return { success: true };
}

export async function logoutAllSessionsAction() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/");
}
