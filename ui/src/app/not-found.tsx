import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border bg-primary/10 text-2xl text-primary">
        ◆
      </span>
      <div className="flex flex-col items-center gap-2">
        <p className="text-5xl font-bold tracking-tight text-primary">404</p>
        <h1 className="text-xl font-semibold tracking-tight">
          {t("notFound.title")}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("notFound.description")}
        </p>
      </div>
      <Button asChild>
        <Link href="/">{t("notFound.home")}</Link>
      </Button>
    </div>
  );
}
