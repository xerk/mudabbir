"use client";

import { ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  readSecuritySettingsApiV1SuperuserSecuritySettingsGet,
  writeSecuritySettingsApiV1SuperuserSecuritySettingsPut,
} from "@/client/sdk.gen";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { detailFromError } from "@/lib/apiError";
import { useAuth } from "@/lib/auth";

const defaults = {
  requireTwoFactor: false,
  sessionTimeoutMinutes: 0,
  allowedEmailDomains: "",
};

// Platform-wide security policy (super-admin). Stored globally in app_settings.
export default function GlobalSecuritySettingsPage() {
  const t = useTranslations("orgSettings");
  const { user, loading: authLoading } = useAuth();
  const hasFetched = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requireTwoFactor, setRequireTwoFactor] = useState(defaults.requireTwoFactor);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(
    defaults.sessionTimeoutMinutes,
  );
  const [allowedEmailDomains, setAllowedEmailDomains] = useState(
    defaults.allowedEmailDomains,
  );

  useEffect(() => {
    if (authLoading || !user || hasFetched.current) return;
    hasFetched.current = true;
    void fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const result = await readSecuritySettingsApiV1SuperuserSecuritySettingsGet();
      if (result.error || !result.data) {
        toast.error(detailFromError(result.error, t("security.loadError")));
        return;
      }
      const s = result.data;
      setRequireTwoFactor(s.requireTwoFactor ?? defaults.requireTwoFactor);
      setSessionTimeoutMinutes(s.sessionTimeoutMinutes ?? defaults.sessionTimeoutMinutes);
      setAllowedEmailDomains(s.allowedEmailDomains ?? defaults.allowedEmailDomains);
    } catch {
      toast.error(t("security.loadError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await writeSecuritySettingsApiV1SuperuserSecuritySettingsPut({
        body: { requireTwoFactor, sessionTimeoutMinutes, allowedEmailDomains },
      });
      if (result.error || !result.data) {
        toast.error(detailFromError(result.error, t("security.saveError")));
        return;
      }
      toast.success(t("security.saveSuccess"));
    } catch {
      toast.error(t("security.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 gap-2">
        <Link href="/admin">
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("backToAdmin")}
        </Link>
      </Button>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            {t("security.title")}
          </CardTitle>
          <CardDescription>{t("security.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {loading ? (
            <div className="flex flex-col gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-4 py-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="requireTwoFactor">
                    {t("security.requireTwoFactor")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("security.requireTwoFactorNote")}
                  </p>
                </div>
                <Switch
                  id="requireTwoFactor"
                  checked={requireTwoFactor}
                  onCheckedChange={setRequireTwoFactor}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="sessionTimeoutMinutes">
                  {t("security.sessionTimeout")}
                </Label>
                <Input
                  id="sessionTimeoutMinutes"
                  type="number"
                  min={0}
                  value={sessionTimeoutMinutes}
                  onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("security.sessionTimeoutNote")}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="allowedEmailDomains">
                  {t("security.allowedDomains")}
                </Label>
                <Input
                  id="allowedEmailDomains"
                  value={allowedEmailDomains}
                  onChange={(e) => setAllowedEmailDomains(e.target.value)}
                  placeholder="example.com, company.org"
                />
                <p className="text-xs text-muted-foreground">
                  {t("security.allowedDomainsNote")}
                </p>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save className="me-2 h-4 w-4" />
            {saving ? t("saving") : t("save")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
