"use client";

import type { Team } from "@stackframe/stack";
import {
  AlertTriangle,
  ArrowUpCircle,
  AudioLines,
  Brain,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleDollarSign,
  Database,
  FileText,
  Home,
  Key,
  List,
  LogOut,
  type LucideIcon,
  Mail,
  Megaphone,
  Monitor,
  Moon,
  Phone,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import React, { useEffect, useRef, useState } from "react";

import { getAuthUserApiV1UserAuthUserGet } from "@/client/sdk.gen";
import { OrgSwitcher } from "@/components/org-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppConfig } from "@/context/AppConfigContext";
import { useTelephonyConfigWarnings } from "@/context/TelephonyConfigWarningsContext";
import { useLatestReleaseVersion } from "@/hooks/useLatestReleaseVersion";
import { isRtl } from "@/i18n/config";
import type { LocalUser } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type SidebarNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  showsTelephonyWarning?: boolean;
};

type SidebarNavSection = {
  label?: string;
  items: SidebarNavItem[];
};

// Telephony warning copy uses the nav translation key "telephonyActionRequired".
const TELEPHONY_WARNING_KEY = "telephonyActionRequired";

const NAV_SECTIONS: SidebarNavSection[] = [
  {
    items: [
      {
        title: "overview",
        url: "/overview",
        icon: Home,
      },
    ],
  },
  {
    label: "sectionBuild",
    items: [
      {
        title: "voiceAgents",
        url: "/workflow",
        icon: Workflow,
      },
      {
        title: "campaigns",
        url: "/campaigns",
        icon: Megaphone,
      },
      {
        title: "models",
        url: "/model-configurations",
        icon: Brain,
      },
      {
        title: "telephony",
        url: "/telephony-configurations",
        icon: Phone,
        showsTelephonyWarning: true,
      },
      {
        title: "tools",
        url: "/tools",
        icon: Wrench,
      },
      {
        title: "files",
        url: "/files",
        icon: Database,
      },
      {
        title: "recordings",
        url: "/recordings",
        icon: AudioLines,
      },
      {
        title: "developers",
        url: "/api-keys",
        icon: Key,
      },
    ],
  },
  {
    label: "sectionObserve",
    items: [
      {
        title: "agentRuns",
        url: "/usage",
        icon: TrendingUp,
      },
      {
        title: "reports",
        url: "/reports",
        icon: FileText,
      },
    ],
  },
];

// Global-admin nav (shown when in /admin/* — super-admin only).
const ADMIN_NAV_SECTIONS: SidebarNavSection[] = [
  {
    label: "sectionAdmin",
    items: [
      { title: "adminDashboard", url: "/admin", icon: Home },
      { title: "adminOrganizations", url: "/admin/organizations", icon: Building2 },
      { title: "adminUsers", url: "/admin/users", icon: Users },
      { title: "adminRuns", url: "/admin/runs", icon: List },
      { title: "adminMail", url: "/admin/mail", icon: Mail },
      { title: "adminMailLog", url: "/admin/mail-log", icon: List },
      { title: "adminSecurity", url: "/admin/security", icon: ShieldCheck },
    ],
  },
];

// Lazy load SelectedTeamSwitcher - we'll pass selectedTeam from our context
const StackTeamSwitcher = React.lazy(() =>
  import("@stackframe/stack").then((mod) => ({
    default: mod.SelectedTeamSwitcher,
  }))
);

export function AppSidebar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  // The sidebar lives at the inline-start edge: left in LTR, right in RTL.
  // shadcn's <Sidebar> is fully physical + side-gated, so we flip via `side`.
  const sidebarSide = isRtl(locale) ? "right" : "left";
  const pathname = usePathname();
  const router = useRouter();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { provider, getSelectedTeam, logout, user, getAccessToken } = useAuth();
  const { config } = useAppConfig();
  const { telnyxMissingWebhookPublicKeyCount } = useTelephonyConfigWarnings();
  const hasTelephonyWarning = telnyxMissingWebhookPublicKeyCount > 0;
  const isCollapsed = !isMobile && state === "collapsed";

  // Context-aware nav. Org + settings pages live under /[slug]/*; admin is
  // top-level. The first path segment is the workspace slug (org mode).
  const segments = pathname.split("/").filter(Boolean);
  const isAdminMode = segments[0] === "admin";
  const slug = !isAdminMode ? segments[0] ?? "" : "";
  // Workspace settings keep the main workspace sidebar; the settings sub-nav
  // (General / Members / Teams / Regional) lives as tabs inside the page.
  const navSections = isAdminMode ? ADMIN_NAV_SECTIONS : NAV_SECTIONS;
  // Slug-prefix org/settings nav hrefs; admin items are already absolute.
  const hrefFor = (url: string) => (isAdminMode || !slug ? url : `/${slug}${url}`);

  // Surface the Admin (super-admin) entry only for superusers.
  const [isSuperuser, setIsSuperuser] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = await getAccessToken();
        const res = await getAuthUserApiV1UserAuthUserGet({
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active && res.data) setIsSuperuser(Boolean(res.data.is_superuser));
      } catch {
        // Non-superusers (or errors) simply don't see the admin entry.
      }
    })();
    return () => {
      active = false;
    };
  }, [getAccessToken]);

  // Theme preference (light / dark / system). "system" means no stored value —
  // the inline script in layout.tsx applies prefers-color-scheme on load.
  type ThemePref = "light" | "dark" | "system";
  const [themePref, setThemePref] = useState<ThemePref>("system");
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    setThemePref(stored === "light" || stored === "dark" ? stored : "system");
  }, []);
  const applyTheme = (pref: ThemePref) => {
    setThemePref(pref);
    if (pref === "system") {
      localStorage.removeItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      localStorage.setItem("theme", pref);
      document.documentElement.classList.toggle("dark", pref === "dark");
    }
  };

  // Unified user display fields across auth providers.
  const isStack = provider === "stack";
  const userEmail = isStack
    ? (user as { primaryEmail?: string } | undefined)?.primaryEmail
    : (user as LocalUser | undefined)?.email;
  const displayName = user?.displayName || userEmail?.split("@")[0] || "User";
  const userInitials =
    (user?.displayName || userEmail || "U")
      .split(/[\s@.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase())
      .join("") || "U";

  // Get selected team for Stack auth (cast to Team type from Stack)
  // Stabilize the reference so SelectedTeamSwitcher only sees a change when the team ID changes,
  // preventing unnecessary PATCH calls to Stack Auth on every route navigation.
  const selectedTeamRef = useRef<Team | null>(null);
  const rawSelectedTeam = provider === "stack" && getSelectedTeam ? getSelectedTeam() as Team | null : null;
  if (rawSelectedTeam?.id !== selectedTeamRef.current?.id) {
    selectedTeamRef.current = rawSelectedTeam;
  }
  const selectedTeam = selectedTeamRef.current;

  // Version info from app config context
  const versionInfo = config ? { ui: config.uiVersion, api: config.apiVersion } : null;

  // Check for updates only on self-hosted (OSS) deployments — cloud is managed for the user.
  const { latest: latestRelease, isBehind, isLatest } = useLatestReleaseVersion(
    versionInfo?.ui,
    { enabled: config?.deploymentMode === "oss" },
  );

  const isActive = (url: string) => {
    const full = hrefFor(url);
    // Index routes (admin dashboard, settings general) match exactly.
    if (full === "/admin" || full === `/${slug}/settings`) return pathname === full;
    return pathname === full || pathname.startsWith(`${full}/`);
  };

  const handleMobileNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const SidebarLink = ({ item }: { item: SidebarNavItem }) => {
    const isItemActive = isActive(item.url);
    const Icon = item.icon;
    const showWarningDot = item.showsTelephonyWarning && hasTelephonyWarning;
    const tooltip = {
      children: (
        <div className="notranslate" translate="no">
          <p>{t(item.title)}</p>
          {showWarningDot && (
            <p className="text-amber-600 dark:text-amber-400">{t(TELEPHONY_WARNING_KEY)}</p>
          )}
        </div>
      ),
    };
    const warningIndicator = (
      <AlertTriangle
        aria-label={t(TELEPHONY_WARNING_KEY)}
        className={cn(
          "text-amber-500",
          isCollapsed ? "absolute -end-0.5 -top-0.5 h-3 w-3" : "ms-auto h-3.5 w-3.5"
        )}
      />
    );

    return (
      <SidebarMenuButton
        asChild
        tooltip={tooltip}
        className={cn(
          "hover:bg-accent hover:text-accent-foreground",
          isItemActive && "bg-accent text-accent-foreground"
        )}
      >
        <Link
          href={hrefFor(item.url)}
          onClick={handleMobileNavClick}
          className={cn("relative", isCollapsed && "justify-center")}
          translate="no"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span
            className={cn("notranslate min-w-0 flex-1 truncate", isCollapsed && "sr-only")}
            translate="no"
          >
            {t(item.title)}
          </span>
          {showWarningDot && (
            isCollapsed ? (
              warningIndicator
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  {warningIndicator}
                </TooltipTrigger>
                <TooltipContent side={sidebarSide === "right" ? "left" : "right"}>
                  <p>{t(TELEPHONY_WARNING_KEY)}</p>
                </TooltipContent>
              </Tooltip>
            )
          )}
        </Link>
      </SidebarMenuButton>
    );
  };

  return (
    <Sidebar side={sidebarSide} collapsible="icon" className="border-e">
      <SidebarHeader className="border-b px-2 py-3 notranslate" translate="no">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex-none">
            <OrgSwitcher side={sidebarSide} isSuperuser={isSuperuser} />
          </div>
          <SidebarTrigger className="hover:bg-accent shrink-0">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            ) : (
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            )}
          </SidebarTrigger>
        </div>

        {provider === "stack" && (
          <div className={cn("mt-3 notranslate", isCollapsed && "hidden")} translate="no">
            <React.Suspense
              fallback={
                <div className="h-9 w-full animate-pulse rounded bg-muted" />
              }
            >
              <StackTeamSwitcher
                selectedTeam={selectedTeam || undefined}
                onChange={() => {
                  router.refresh();
                }}
              />
            </React.Suspense>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className={cn("notranslate", isCollapsed && "px-0")} translate="no">
        {navSections.map((section, index) => (
          <SidebarGroup
            key={section.label ?? "overview"}
            className={index === 0 ? "mt-2" : "mt-6"}
          >
            {section.label && (
              <SidebarGroupLabel
                className={cn(
                  "notranslate text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                  isCollapsed && "hidden"
                )}
                translate="no"
              >
                {t(section.label)}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarLink item={item} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="notranslate" translate="no">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={{ children: <span className="notranslate" translate="no">{displayName}</span> }}
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                    {userInitials}
                  </span>
                  <div className="grid flex-1 text-start text-sm leading-tight">
                    <span className="truncate font-semibold">{displayName}</span>
                    {userEmail && (
                      <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                    )}
                  </div>
                  <ChevronsUpDown className="ms-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-64 rounded-lg"
                side={isMobile ? "bottom" : sidebarSide === "right" ? "left" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                    <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                      {userInitials}
                    </span>
                    <div className="grid flex-1 text-start text-sm leading-tight">
                      <span className="truncate font-semibold">{displayName}</span>
                      {userEmail && (
                        <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {isStack && (
                    <DropdownMenuItem onClick={() => router.push("/handler/account-settings")} className="cursor-pointer">
                      <Settings className="me-2 h-4 w-4" />
                      {t("accountSettings")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
                    <Settings className="me-2 h-4 w-4" />
                    {t("platformSettings")}
                  </DropdownMenuItem>
                  {isStack && (
                    <DropdownMenuItem onClick={() => router.push("/usage")} className="cursor-pointer">
                      <CircleDollarSign className="me-2 h-4 w-4" />
                      {t("usage")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <div className="mb-1.5 text-xs text-muted-foreground">{t("theme")}</div>
                  <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                    {([
                      { value: "light", icon: Sun, label: t("themeLight") },
                      { value: "dark", icon: Moon, label: t("themeDark") },
                      { value: "system", icon: Monitor, label: t("themeSystem") },
                    ] as const).map(({ value, icon: Icon, label }) => (
                      <button
                        key={value}
                        type="button"
                        aria-label={label}
                        title={label}
                        aria-pressed={themePref === value}
                        onClick={(e) => {
                          e.preventDefault();
                          applyTheme(value);
                        }}
                        className={cn(
                          "flex flex-1 items-center justify-center rounded-sm py-1.5 transition-colors",
                          themePref === value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer">
                  <LogOut className="me-2 h-4 w-4" />
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className={cn("flex items-center gap-2 px-2 pb-1", isCollapsed && "hidden")}>
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            translate="no"
          >
            mudabbir
            {versionInfo && (
              <span className="text-xs font-normal text-muted-foreground">
                v{versionInfo.ui}
              </span>
            )}
          </Link>
          {isBehind && latestRelease && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="https://docs.dograh.com/deployment/update"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-900 transition-opacity hover:opacity-80 dark:bg-amber-950 dark:text-amber-200"
                >
                  <ArrowUpCircle className="h-3 w-3" />
                  {t("update")}
                </a>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{t("updateTooltip", { version: latestRelease })}</p>
              </TooltipContent>
            </Tooltip>
          )}
          {isLatest && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center rounded-md border bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                  {t("latest")}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{t("latestTooltip")}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
