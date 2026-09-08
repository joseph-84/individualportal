"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestShareOtpAction, verifyShareOtpAction } from "@/app/actions/share-view";

export function ShareOtpGate({ token, fileName, maskedEmail }: { token: string; fileName: string; maskedEmail: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "sent">("request");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const requestOtp = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestShareOtpAction(token);
      if (res.error) setError(res.error);
      else setStep("sent");
    });
  };

  const verify = () => {
    setError(null);
    startTransition(async () => {
      const res = await verifyShareOtpAction(token, code);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div>
      <h1 style={{ fontSize: 16, margin: "0 0 6px" }}>{fileName}</h1>
      <p style={{ fontSize: 13, color: "#57534d", margin: "0 0 18px" }}>
        이 파일은 <strong>{maskedEmail}</strong>로만 열람이 제한되어 있습니다. 인증 코드를 받아 확인해주세요.
      </p>

      {step === "request" && (
        <button
          onClick={requestOtp}
          disabled={pending}
          style={{ width: "100%", height: 40, border: 0, borderRadius: 8, background: "#b0512e", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: pending ? "default" : "pointer" }}
        >
          {pending ? "발송 중..." : "인증 코드 받기"}
        </button>
      )}

      {step === "sent" && (
        <>
          <p style={{ fontSize: 12.5, color: "#2f7350", margin: "0 0 12px" }}>인증 코드를 이메일로 보냈습니다. 10분 내에 입력해주세요.</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6자리 코드"
            inputMode="numeric"
            style={{ width: "100%", height: 40, padding: "0 12px", marginBottom: 10, border: "1px solid #e4e0da", borderRadius: 8, fontSize: 16, letterSpacing: "0.2em", textAlign: "center" }}
          />
          <button
            onClick={verify}
            disabled={pending || code.length !== 6}
            style={{ width: "100%", height: 40, border: 0, borderRadius: 8, background: "#b0512e", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: code.length !== 6 ? 0.5 : 1, marginBottom: 8 }}
          >
            {pending ? "확인 중..." : "확인"}
          </button>
          <button onClick={requestOtp} disabled={pending} style={{ width: "100%", height: 32, border: 0, background: "transparent", color: "#57534d", fontSize: 12, cursor: "pointer" }}>
            코드 다시 받기
          </button>
        </>
      )}

      {error && <div style={{ marginTop: 10, fontSize: 12.5, color: "#a83326" }}>{error}</div>}
    </div>
  );
}
