"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { loginApiV1AuthLoginPost } from "@/client/sdk.gen";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InteractiveHoverButton from "@/components/ui/interactive-hover-button";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Returns false on failure so the button animation resets to idle.
  const handleLogin = async (): Promise<boolean> => {
    if (!email || !password) {
      toast.error(t("missingFields"));
      return false;
    }
    setLoading(true);
    try {
      const res = await loginApiV1AuthLoginPost({ body: { email, password } });

      if (res.error || !res.data) {
        const detail = (res.error as { detail?: string })?.detail;
        toast.error(detail || t("failed"));
        return false;
      }

      // Set httpOnly cookies via server route
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: res.data.token, user: res.data.user }),
      });

      window.location.href = "/after-sign-in";
      return true;
    } catch {
      toast.error(t("generic"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="mb-2 flex size-10 items-center justify-center rounded-xl border bg-primary/10 text-lg text-primary">
          ◆
        </span>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              className="ps-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t("password")}</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder={t("passwordPlaceholder")}
              className="ps-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleLogin();
              }}
            />
          </div>
        </div>

        <InteractiveHoverButton
          text={t("submit")}
          loadingText={t("submitting")}
          successText={t("success")}
          className="mt-1 w-full"
          disabled={loading}
          onClick={handleLogin}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href="/auth/signup"
          className="text-foreground underline-offset-4 hover:underline"
        >
          {t("createOne")}
        </Link>
      </p>
    </div>
  );
}
