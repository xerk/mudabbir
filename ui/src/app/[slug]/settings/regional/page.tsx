"use client";

import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getSettingsApiV1OrganizationsSettingsGet,
  updateSettingsApiV1OrganizationsSettingsPut,
} from "@/client/sdk.gen";
import type { RegionalSettings } from "@/client/types.gen";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { detailFromError } from "@/lib/apiError";
import { useAuth } from "@/lib/auth";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Cairo",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];
const CURRENCIES = ["USD", "SAR", "EUR", "GBP", "AED", "EGP", "INR", "JPY"];
const DATE_FORMATS = [
  "MMM D, YYYY",
  "D MMM YYYY",
  "YYYY-MM-DD",
  "MM/DD/YYYY",
  "DD/MM/YYYY",
];
const NUMBER_FORMATS = ["en-US", "en-GB", "ar-SA", "fr-FR", "de-DE", "ja-JP"];

const defaults: Required<RegionalSettings> = {
  timezone: "UTC",
  currency: "USD",
  dateFormat: "MMM D, YYYY",
  timeFormat: "12h",
  numberFormat: "en-US",
};

/** Keep the stored value selectable even if it isn't in our preset list. */
function withValue(list: string[], value: string): string[] {
  return list.includes(value) ? list : [value, ...list];
}

export default function RegionalSettingsPage() {
  const t = useTranslations("orgSettings");
  const { user, loading: authLoading } = useAuth();
  const hasFetched = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezone, setTimezone] = useState(defaults.timezone);
  const [currency, setCurrency] = useState(defaults.currency);
  const [dateFormat, setDateFormat] = useState(defaults.dateFormat);
  const [timeFormat, setTimeFormat] = useState(defaults.timeFormat);
  const [numberFormat, setNumberFormat] = useState(defaults.numberFormat);

  useEffect(() => {
    if (authLoading || !user || hasFetched.current) {
      return;
    }
    hasFetched.current = true;
    void fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function fetchSettings() {
    setLoading(true);
    try {
      const result = await getSettingsApiV1OrganizationsSettingsGet();
      if (result.error) {
        toast.error(detailFromError(result.error, t("regional.loadError")));
        return;
      }
      const r = result.data?.regional ?? {};
      setTimezone(r.timezone ?? defaults.timezone);
      setCurrency(r.currency ?? defaults.currency);
      setDateFormat(r.dateFormat ?? defaults.dateFormat);
      setTimeFormat(r.timeFormat ?? defaults.timeFormat);
      setNumberFormat(r.numberFormat ?? defaults.numberFormat);
    } catch {
      toast.error(t("regional.loadError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateSettingsApiV1OrganizationsSettingsPut({
        body: {
          regional: {
            timezone,
            currency,
            dateFormat,
            timeFormat,
            numberFormat,
          },
        },
      });
      if (result.error || !result.data) {
        toast.error(detailFromError(result.error, t("regional.saveError")));
        return;
      }
      toast.success(t("regional.saveSuccess"));
    } catch {
      toast.error(t("regional.saveError"));
    } finally {
      setSaving(false);
    }
  }

  // Live preview using the chosen locale / timezone / currency.
  const now = new Date();
  let datePreview = "—";
  let timePreview = "—";
  let moneyPreview = "—";
  try {
    datePreview = new Intl.DateTimeFormat(numberFormat, {
      dateStyle: "medium",
      timeZone: timezone,
    }).format(now);
    timePreview = new Intl.DateTimeFormat(numberFormat, {
      hour: "numeric",
      minute: "2-digit",
      hour12: timeFormat === "12h",
      timeZone: timezone,
    }).format(now);
    moneyPreview = new Intl.NumberFormat(numberFormat, {
      style: "currency",
      currency,
    }).format(1234.5);
  } catch {
    // Invalid combination — leave the em-dashes.
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{t("regional.title")}</CardTitle>
        <CardDescription>{t("regional.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Selector
                label={t("regional.timezone")}
                value={timezone}
                onChange={setTimezone}
                options={withValue(TIMEZONES, timezone)}
              />
              <Selector
                label={t("regional.currency")}
                value={currency}
                onChange={setCurrency}
                options={withValue(CURRENCIES, currency)}
              />
              <Selector
                label={t("regional.dateFormat")}
                value={dateFormat}
                onChange={setDateFormat}
                options={withValue(DATE_FORMATS, dateFormat)}
              />
              <Selector
                label={t("regional.timeFormat")}
                value={timeFormat}
                onChange={setTimeFormat}
                options={["12h", "24h"]}
                renderOption={(opt) =>
                  opt === "12h"
                    ? t("regional.timeFormat12h")
                    : t("regional.timeFormat24h")
                }
              />
              <Selector
                label={t("regional.numberFormat")}
                value={numberFormat}
                onChange={setNumberFormat}
                options={withValue(NUMBER_FORMATS, numberFormat)}
              />
            </div>

            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {t("regional.preview")}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-foreground">
                <span>{datePreview}</span>
                <span>{timePreview}</span>
                <span>{moneyPreview}</span>
              </div>
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
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
  renderOption,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  renderOption?: (opt: string) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {renderOption ? renderOption(opt) : opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
