"use client";

import { ArrowLeft, List, Loader2, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { readMailLogApiV1SuperuserMailLogGet } from "@/client/sdk.gen";
import type { MailLogEntry } from "@/client/types.gen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { detailFromError } from "@/lib/apiError";
import { useAuth } from "@/lib/auth";

type Status = "sent" | "skipped" | "failed";

const statusVariant: Record<Status, "default" | "secondary" | "destructive"> = {
  sent: "default",
  skipped: "secondary",
  failed: "destructive",
};

export default function GlobalMailLogPage() {
  const t = useTranslations("adminMail.log");
  const tOrg = useTranslations("orgSettings");
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const hasFetched = useRef(false);

  const [entries, setEntries] = useState<MailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const result = await readMailLogApiV1SuperuserMailLogGet({
        query: { limit: 200, offset: 0 },
      });
      if (result.error || !result.data) {
        toast.error(detailFromError(result.error, t("empty")));
        return;
      }
      setEntries(result.data);
    } catch {
      toast.error(t("empty"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (authLoading || !user || hasFetched.current) return;
    hasFetched.current = true;
    void fetchLog();
  }, [authLoading, user, fetchLog]);

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const statusLabel = (status: string) =>
    ["sent", "skipped", "failed"].includes(status)
      ? t(`status.${status}` as `status.${Status}`)
      : status;

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 gap-2">
        <Link href="/admin">
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {tOrg("backToAdmin")}
        </Link>
      </Button>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <List className="size-5 text-primary" />
              {t("title")}
            </CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchLog()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            {t("refresh")}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.to")}</TableHead>
                  <TableHead>{t("columns.subject")}</TableHead>
                  <TableHead>{t("columns.template")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                  <TableHead>{t("columns.sentAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.to_email}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.subject ?? "—"}
                    </TableCell>
                    <TableCell>{entry.template ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant[entry.status as Status] ?? "secondary"}
                      >
                        {statusLabel(entry.status)}
                      </Badge>
                      {entry.status === "failed" && entry.error ? (
                        <p
                          className="mt-1 max-w-xs truncate text-xs text-muted-foreground"
                          title={entry.error}
                        >
                          {entry.error}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(entry.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
