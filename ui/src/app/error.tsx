"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border bg-primary/10 text-2xl text-primary">
        ◆
      </span>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("error.title")}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("error.description")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()}>{t("error.retry")}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t("error.home")}</Link>
        </Button>
      </div>
    </div>
  );
}
