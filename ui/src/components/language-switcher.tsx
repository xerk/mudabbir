"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { isRtl, localeNames, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";
import { cn } from "@/lib/utils";

/** Toggle between English and Arabic. Persists the choice in a cookie, applies
 *  <html lang/dir> immediately on the client, then does a *soft* refresh so the
 *  server re-renders translations in place — no full page reload, no flash, and
 *  scroll/client state is preserved. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const next: Locale = locale === "ar" ? "en" : "ar";

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-2", className)}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocale(next);
          // Apply direction immediately on the client, then soft-refresh so the
          // server re-renders translations without a full page reload.
          document.documentElement.lang = next;
          document.documentElement.dir = isRtl(next) ? "rtl" : "ltr";
          router.refresh();
        })
      }
    >
      <Languages className="size-4" />
      <span className="text-xs font-medium">{localeNames[next]}</span>
    </Button>
  );
}
