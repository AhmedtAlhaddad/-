"use client";

import {
  useState,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

const supabase = createClient();

export function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setLoading(true);

    const {
      error: signInError,
    } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (signInError) {
      setError(
        "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      );

      setLoading(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div>
          <span className="eyebrow">
            عالم اللياقة
          </span>

          <h1>
            تسجيل دخول الإدارة
          </h1>

          <p>
            هذه الصفحة مخصصة لإدارة المتجر.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            <span>
              البريد الإلكتروني
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>
              كلمة المرور
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <p
              role="alert"
              className="admin-login-error"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="button primary"
            disabled={loading}
          >
            {loading
              ? "جارٍ تسجيل الدخول..."
              : "تسجيل الدخول"}
          </button>
        </form>
      </section>
    </main>
  );
}
