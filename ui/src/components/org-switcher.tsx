"use client";

import { Building2, Check, ChevronsUpDown, Settings, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  listMyOrganizationsApiV1OrganizationsMineGet,
  selectOrganizationApiV1OrganizationsSelectPost,
} from "@/client/sdk.gen";
import type { OrganizationSummary } from "@/client/types.gen";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import enMessages from "@/messages/en/workspace.json";
import arMessages from "@/messages/ar/workspace.json";
import { useAuth } from "@/lib/auth";
import logger from "@/lib/logger";
import { cn } from "@/lib/utils";

// The "workspace" namespace is not registered in messages/*/index.ts (that file
// must not be edited), so we resolve copy locally against the active locale.
const MESSAGES = { en: enMessages, ar: arMessages } as const;

type Side = "left" | "right";

interface OrgSwitcherProps {
  /** Which physical side the sidebar sits on, for dropdown placement. */
  side?: Side;
  /** Show an "Admin" entry that links to the super-admin area. */
  isSuperuser?: boolean;
}

function knownRoleLabel(
  role: string,
  roles: Record<string, string>
): string | null {
  const key = role.toLowerCase();
  return key in roles ? roles[key] : null;
}

export function OrgSwitcher({ side = "left", isSuperuser = false }: OrgSwitcherProps) {
  const locale = useLocale();
  const messages = MESSAGES[locale as keyof typeof MESSAGES] ?? MESSAGES.en;
  const { user, loading, getAccessToken } = useAuth();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const pathname = usePathname();
  const isAdminMode = pathname.startsWith("/admin");

  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgName = useCallback(
    (org: OrganizationSummary) =>
      org.name ?? messages.workspaceWithId.replace("{id}", String(org.id)),
    [messages]
  );

  const fetchOrgs = useCallback(async () => {
    if (loading || !user) return;
    try {
      setIsLoading(true);
      const accessToken = await getAccessToken();
      const response = await listMyOrganizationsApiV1OrganizationsMineGet({
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.data) {
        setOrgs(response.data.organizations);
        setSelectedId(response.data.selected_organization_id ?? null);
      }
    } catch (err) {
      logger.error("[OrgSwitcher] Failed to load organizations", err);
    } finally {
      setIsLoading(false);
    }
  }, [loading, user, getAccessToken]);

  useEffect(() => {
    void fetchOrgs();
  }, [fetchOrgs]);

  const handleSelect = useCallback(
    async (organizationId: number) => {
      if (organizationId === selectedId || isSwitching) return;
      try {
        setIsSwitching(true);
        setError(null);
        const accessToken = await getAccessToken();
        await selectOrganizationApiV1OrganizationsSelectPost({
          body: { organization_id: organizationId },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        // Land in the new workspace (leaving admin/settings), re-scoped.
        const target = orgs.find((o) => o.id === organizationId);
        if (target?.slug) {
          document.cookie = `org_slug=${target.slug}; path=/; max-age=31536000; samesite=lax`;
          window.location.href = `/${target.slug}/overview`;
        } else {
          window.location.href = "/";
        }
      } catch (err) {
        logger.error("[OrgSwitcher] Failed to switch organization", err);
        setError(messages.switchError);
        setIsSwitching(false);
      }
    },
    [selectedId, isSwitching, getAccessToken, messages]
  );

  // Nothing to show until we have data (avoids a flash of an empty trigger).
  if (isLoading && orgs.length === 0) {
    return (
      <div className="h-9 w-full animate-pulse rounded-md bg-muted" aria-hidden />
    );
  }

  if (orgs.length === 0) return null;

  const activeOrg = orgs.find((o) => o.id === selectedId) ?? orgs[0];
  const activeRoleLabel = knownRoleLabel(activeOrg.role, messages.roles);
  const dropdownSide = side === "right" ? "left" : "right";

  const Trigger = (
    <SidebarMenuButton
      size="lg"
      disabled={isSwitching}
      aria-label={messages.switchWorkspace}
      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
    >
      <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {isAdminMode ? <ShieldCheck className="size-4" /> : <Building2 className="size-4" />}
      </span>
      {!collapsed && (
        <>
          <div className="grid min-w-0 flex-1 text-start leading-tight">
            <span className="truncate text-sm font-semibold">
              {isAdminMode ? messages.admin : orgName(activeOrg)}
            </span>
            {!isAdminMode && activeRoleLabel && (
              <span className="truncate text-xs text-muted-foreground">
                {activeRoleLabel}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ms-auto size-4 shrink-0" />
        </>
      )}
    </SidebarMenuButton>
  );

  return (
    <div className="notranslate">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{Trigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          side={dropdownSide}
          align="start"
          sideOffset={4}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {messages.switchWorkspace}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {orgs.map((org) => {
            const isActive = org.id === selectedId;
            const roleLabel = knownRoleLabel(org.role, messages.roles);
            return (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSelect(org.id)}
                disabled={isSwitching}
                className="cursor-pointer gap-2"
              >
                <span className="flex aspect-square size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="size-3.5" />
                </span>
                <div className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate text-sm">{orgName(org)}</span>
                  {roleLabel && (
                    <span className="truncate text-xs text-muted-foreground">
                      {roleLabel}
                    </span>
                  )}
                </div>
                {isActive ? (
                  <Check className="ms-auto size-4 shrink-0 text-primary" />
                ) : (
                  <Badge variant="outline" className="ms-auto shrink-0 text-[10px]">
                    {roleLabel ?? org.role}
                  </Badge>
                )}
              </DropdownMenuItem>
            );
          })}
          {error && (
            <>
              <DropdownMenuSeparator />
              <p className={cn("px-2 py-1.5 text-xs text-destructive")}>{error}</p>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer gap-2">
            <Link href="/settings">
              <Settings className="size-4" />
              <span>{messages.settings}</span>
            </Link>
          </DropdownMenuItem>
          {isSuperuser && (
            <DropdownMenuItem asChild className="cursor-pointer gap-2">
              <Link href="/admin">
                <ShieldCheck className="size-4" />
                <span>{messages.admin}</span>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
