"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateOtpCode } from "@/lib/share";
import { sendOtpEmail, MailerNotConfiguredError } from "@/lib/mailer";
import { createShareAccessToken, shareAccessCookieName, SHARE_ACCESS_MAX_AGE } from "@/lib/share-otp-auth";
import path from "node:path";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS_PER_HOUR = 5;

export interface RequestOtpState {
  error?: string;
  sent?: boolean;
}

export async function requestShareOtpAction(token: string): Promise<RequestOtpState> {
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link || link.revoked || link.scope !== "email_otp" || !link.email) {
    return { error: "유효하지 않은 공유 링크입니다." };
  }

  const recentCount = await prisma.shareOtp.count({
    where: { shareLinkId: link.id, createdAt: { gte: new Date(Date.now() - 3600_000) } },
  });
  if (recentCount >= MAX_ATTEMPTS_PER_HOUR) {
    return { error: "인증 코드 요청이 너무 많습니다. 잠시 후 다시 시도하세요." };
  }

  const code = generateOtpCode();
  await prisma.shareOtp.create({
    data: { shareLinkId: link.id, code, expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000) },
  });

  try {
    await sendOtpEmail(link.email, code, path.basename(link.relPath));
  } catch (e) {
    if (e instanceof MailerNotConfiguredError) return { error: e.message };
    return { error: "이메일 발송에 실패했습니다." };
  }

  return { sent: true };
}

export interface VerifyOtpState {
  error?: string;
  verified?: boolean;
}

export async function verifyShareOtpAction(token: string, code: string): Promise<VerifyOtpState> {
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link || link.revoked || link.scope !== "email_otp") {
    return { error: "유효하지 않은 공유 링크입니다." };
  }

  const otp = await prisma.shareOtp.findFirst({
    where: { shareLinkId: link.id, code, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) return { error: "인증 코드가 올바르지 않거나 만료되었습니다." };

  await prisma.shareOtp.update({ where: { id: otp.id }, data: { consumed: true } });
  await prisma.shareLink.update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } });

  const accessToken = await createShareAccessToken(token);
  const jar = await cookies();
  jar.set(shareAccessCookieName(token), accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SHARE_ACCESS_MAX_AGE,
  });

  return { verified: true };
}
