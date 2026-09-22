"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import styles from "./admin-login.module.css";

export function AdminLogin({
  returnTo,
}: {
  returnTo: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, returnTo }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const message =
        typeof payload === "object" &&
        payload !== null &&
        !Array.isArray(payload) &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "اسم المستخدم أو كلمة المرور غير صحيحة.";

      if (!response.ok) {
        setError(message);
        return;
      }

      router.replace(returnTo);
      router.refresh();
    } catch {
      setError("تعذر إكمال تسجيل الدخول. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page} dir="rtl">
      <section className={styles.card} aria-labelledby="admin-login-title">
        <div className={styles.brandBlock}>
          <span className={styles.mark} aria-hidden="true">AL</span>
          <div>
            <span className={styles.eyebrow}>عالم اللياقة</span>
            <h1 id="admin-login-title">لوحة الإدارة</h1>
            <p>سجّل الدخول لإدارة المتجر والعمليات اليومية.</p>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>اسم المستخدم</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>

          <label className={styles.field}>
            <span>كلمة المرور</span>
            <span className={styles.passwordField}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-pressed={showPassword}
              >
                {showPassword ? "إخفاء" : "إظهار"}
              </button>
            </span>
          </label>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button className={styles.submit} type="submit" disabled={loading}>
            {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className={styles.note}>جلسة الإدارة صالحة لمدة 12 ساعة.</p>
      </section>
    </main>
  );
}
