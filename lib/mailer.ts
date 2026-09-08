import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let cachedTransporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (cachedTransporter !== undefined) return cachedTransporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    cachedTransporter = null;
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return cachedTransporter;
}

export class MailerNotConfiguredError extends Error {}

export async function sendOtpEmail(to: string, code: string, fileName: string) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new MailerNotConfiguredError("이메일 발송이 설정되어 있지 않습니다. 관리자에게 GMAIL_USER/GMAIL_APP_PASSWORD 설정을 요청하세요.");
  }
  const from = process.env.GMAIL_USER;
  await transporter.sendMail({
    from: `Portal <${from}>`,
    to,
    subject: `[Portal] 파일 열람 인증 코드: ${code}`,
    text: `"${fileName}" 파일 열람 인증 코드입니다: ${code}\n\n10분간 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.`,
  });
}
