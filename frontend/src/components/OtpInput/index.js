import { useRef, useState } from "react";
import "./OtpInput.css";

/**
 * OtpInput — composant OTP réutilisable
 *
 * Props :
 *  - length         {number}   — nombre de cases (défaut : 6)
 *  - value          {string[]} — tableau contrôlé depuis le parent
 *  - onChange       {fn}       — (newOtp: string[]) => void
 *  - onComplete     {fn}       — (code: string) => void
 *  - error          {string}   — message d'erreur
 *  - disabled       {bool}
 *  - label          {string}   — libellé au-dessus
 *  - resendLabel    {string}   — texte bouton renvoyer
 *  - onResend       {fn}       — callback renvoyer
 *  - resendCooldown {number}   — secondes avant de renvoyer
 *  - variant        {string}   — "co" | "ao" | "default"
 *                                "co" → style ClientOnboarding  (cases serrées, fond beige)
 *                                "ao" → style AvocatOnboarding  (grandes cases, police serif)
 *                                "default" → style neutre
 */
export default function OtpInput({
  length         = 6,
  value,
  onChange,
  onComplete,
  error          = "",
  disabled       = false,
  label          = "",
  resendLabel    = "Renvoyer le code",
  onResend,
  resendCooldown = 0,
  variant        = "default",
}) {
  const [internal, setInternal] = useState(Array(length).fill(""));
  const otp    = value   ?? internal;
  const setOtp = onChange ?? setInternal;

  const refs = useRef([]);

  const handleChange = (i, raw) => {
    if (!/^\d*$/.test(raw)) return;
    const digit = raw.slice(-1);
    const next  = [...otp];
    next[i]     = digit;
    setOtp(next);
    if (digit && i < length - 1) refs.current[i + 1]?.focus();
    const code = next.join("");
    if (code.length === length && !next.includes("") && onComplete) onComplete(code);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace"  && !otp[i] && i > 0)          refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft"  && i > 0)                      refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1)             refs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    const next = [...otp];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
    if (pasted.length === length && onComplete) onComplete(pasted);
  };

  // ── Classes CSS selon variant ──────────────────────────────────────────────
  const rootClass = `otp-root otp-root--${variant}`;
  const cellClass = (v) =>
    [
      `otp-cell otp-cell--${variant}`,
      v       ? `otp-cell--filled otp-cell--filled-${variant}` : "",
      error   ? `otp-cell--error`                              : "",
      disabled? `otp-cell--disabled`                           : "",
    ].filter(Boolean).join(" ");

  const errorClass  = `otp-error otp-error--${variant}`;
  const resendClass = `otp-resend otp-resend--${variant}`;
  const labelClass  = `otp-label otp-label--${variant}`;

  return (
    <div className={rootClass}>
      {label && <label className={labelClass}>{label}</label>}

      <div className={`otp-row otp-row--${variant}`} onPaste={handlePaste}>
        {otp.map((v, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            className={cellClass(v)}
            value={v}
            maxLength={1}
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
          />
        ))}
      </div>

      {error && <div className={errorClass}>⚠️ {error}</div>}

      {onResend && (
        <div className={resendClass}>
          {resendCooldown > 0 ? (
            <span className={`otp-resend-cd otp-resend-cd--${variant}`}>
              {variant === "co"
                ? `Renvoyer dans `
                : ""}
              <strong>{resendCooldown}s</strong>
            </span>
          ) : (
            <button
              className={`otp-resend-btn otp-resend-btn--${variant}`}
              onClick={onResend}
              disabled={disabled}
              type="button"
            >
              {resendLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}