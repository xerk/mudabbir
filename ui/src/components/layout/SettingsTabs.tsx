"use client";

import { Globe, Settings, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const TABS = [
  { key: "settingsGeneral", url: "/settings", icon: Settings },
  { key: "settingsMembers", url: "/settings/members", icon: Users },
  { key: "settingsTeams", url: "/settings/teams", icon: UsersRound },
  { key: "settingsRegional", url: "/settings/regional", icon: Globe },
] as const;

// Sub-navigation for the workspace settings area, rendered as tabs inside the
// page so the main workspace sidebar stays in place.
export function SettingsTabs() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[0] ?? "";
  const hrefFor = (url: string) => `/${slug}${url}`;

  const isActive = (url: string) => {
    const full = hrefFor(url);
    // General is the index route — match exactly so sub-routes don't light it up.
    if (url === "/settings") return pathname === full;
    return pathname === full || pathname.startsWith(`${full}/`);
  };

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.url);
        return (
          <Link
            key={tab.key}
            href={hrefFor(tab.url)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4" />
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
