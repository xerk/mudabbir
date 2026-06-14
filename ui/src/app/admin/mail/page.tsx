"use client";

import { ArrowLeft, Mail, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  readMailSettingsApiV1SuperuserMailSettingsGet,
  writeMailSettingsApiV1SuperuserMailSettingsPut,
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
  host: "",
  port: 587,
  username: "",
  password: "",
  secure: false,
  fromEmail: "",
};

// Platform-wide SMTP configuration (super-admin). Stored globally in app_settings.
export default function GlobalMailSettingsPage() {
  const t = useTranslations("adminMail.config");
  const tOrg = useTranslations("orgSettings");
  const { user, loading: authLoading } = useAuth();
  const hasFetched = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [host, setHost] = useState(defaults.host);
  const [port, setPort] = useState(defaults.port);
  const [username, setUsername] = useState(defaults.username);
  const [password, setPassword] = useState(defaults.password);
  const [secure, setSecure] = useState(defaults.secure);
  const [fromEmail, setFromEmail] = useState(defaults.fromEmail);

  useEffect(() => {
    if (authLoading || !user || hasFetched.current) return;
    hasFetched.current = true;
    void fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const result = await readMailSettingsApiV1SuperuserMailSettingsGet();
      if (result.error || !result.data) {
        toast.error(detailFromError(result.error, t("saveError")));
        return;
      }
      const s = result.data;
      setHost(s.host ?? defaults.host);
      setPort(s.port ?? defaults.port);
      setUsername(s.username ?? defaults.username);
      setPassword(s.password ?? defaults.password);
      setSecure(s.secure ?? defaults.secure);
      setFromEmail(s.from_email ?? defaults.fromEmail);
    } catch {
      toast.error(t("saveError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await writeMailSettingsApiV1SuperuserMailSettingsPut({
        body: {
          host,
          port,
          username,
          password,
          secure,
          from_email: fromEmail,
        },
      });
      if (result.error || !result.data) {
        toast.error(detailFromError(result.error, t("saveError")));
        return;
      }
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 gap-2">
        <Link href="/admin">
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {tOrg("backToAdmin")}
        </Link>
      </Button>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {loading ? (
            <div className="flex flex-col gap-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="host">{t("host")}</Label>
                <Input
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder={t("hostPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="port">{t("port")}</Label>
                  <Input
                    id="port"
                    type="number"
                    min={1}
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value) || 0)}
                  />
                </div>
                <div className="flex items-end justify-between gap-3 rounded-xl border border-border px-4 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="secure">{t("secure")}</Label>
                    <p className="text-xs text-muted-foreground">{t("secureHint")}</p>
                  </div>
                  <Switch id="secure" checked={secure} onCheckedChange={setSecure} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="username">{t("username")}</Label>
                <Input
                  id="username"
                  value={username}
                  autoComplete="off"
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="fromEmail">{t("fromEmail")}</Label>
                <Input
                  id="fromEmail"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder={t("fromEmailPlaceholder")}
                />
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
