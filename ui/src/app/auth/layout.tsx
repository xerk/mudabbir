import { getTranslations } from "next-intl/server";

import ThemeToggle from "@/components/ThemeSwitcher";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NetworkBackground } from "@/components/network-background";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tc = await getTranslations("common");
  const t = await getTranslations("auth.brand");
  const appName = tc("appName");
  const pills = [t("build"), t("deploy"), t("manage")];

  return (
    <div className="flex min-h-svh">
      {/* Brand panel */}
      <div
        className="relative hidden flex-col overflow-hidden md:flex md:w-[55%] lg:w-[58%]"
        style={{
          background:
            "radial-gradient(ellipse at top, #1a1530 0%, #0a0a0f 50%, #0a0a0f 100%)",
        }}
      >
        {/* Animated agent network — mirrors mudabbir's hero canvas */}
        <NetworkBackground className="opacity-70" />

        {/* Film-grain noise overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Brand wordmark — pinned to absolute center */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="flex items-center gap-3 text-5xl font-semibold tracking-tight text-white">
            <span className="text-3xl text-[#a78bfa]" aria-hidden="true">
              ◆
            </span>
            {appName}
          </span>
        </div>

        {/* Content below center — tagline + capability pills */}
        <div
          className="absolute inset-x-0 z-10 flex flex-col items-center px-8 text-center"
          style={{ top: "calc(50% + 72px)" }}
        >
          <p
            className="max-w-md text-lg font-medium leading-relaxed text-transparent"
            style={{
              backgroundImage: "linear-gradient(90deg, #a78bfa, #00d4ff)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            {t("tagline")}
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/45">
            {t("subtitle")}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {pills.map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/55"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Form area */}
      <div className="relative flex w-full flex-col bg-background md:w-[45%] lg:w-[42%]">
        {/* Top-right controls: language + theme */}
        <div className="absolute end-4 top-4 z-10 flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle className="size-8 text-muted-foreground hover:text-foreground" />
        </div>

        {/* Centered content */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
          {/* Mobile wordmark */}
          <div className="mb-10 flex items-center gap-2 md:hidden">
            <span className="text-2xl text-[#a78bfa]" aria-hidden="true">
              ◆
            </span>
            <span className="text-3xl font-semibold tracking-tight">
              {appName}
            </span>
          </div>

          <div className="w-full max-w-[360px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
