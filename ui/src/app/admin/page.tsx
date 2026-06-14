"use client";

import {
    ArrowRight,
    Building2,
    List,
    Loader2,
    Mail,
    ShieldCheck,
    UserCog,
    Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getStatsApiV1AdminStatsGet } from "@/client/sdk.gen";
import type { AdminStatsResponse } from "@/client/types.gen";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { impersonateAsSuperadmin } from "@/lib/utils";

export default function SuperadminPage() {
    const t = useTranslations("superadmin");
    const locale = useLocale();
    const { user, getAccessToken } = useAuth();

    const [stats, setStats] = useState<AdminStatsResponse | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const [userId, setUserId] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const response = await getStatsApiV1AdminStatsGet();
            if (response.data) {
                setStats(response.data);
            }
        } catch (err) {
            console.error("Fetch admin stats error:", err);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchStats();
    }, [fetchStats]);

    const formatDate = (value: string) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return new Intl.DateTimeFormat(locale, {
            year: "numeric",
            month: "short",
            day: "numeric",
        }).format(date);
    };

    const handleImpersonate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            if (!user) {
                setError(t("errors.notAuthenticated"));
                setIsLoading(false);
                return;
            }
            const accessToken = await getAccessToken();
            if (!accessToken) {
                throw new Error("Missing admin access token");
            }

            await impersonateAsSuperadmin({
                accessToken: accessToken,
                providerUserId: userId,
                redirectPath: "/workflow",
                openInNewTab: true,
            });
        } catch (err) {
            setError(t("errors.impersonateFailed"));
            console.error("Impersonation error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="container mx-auto space-y-6 p-6">
            <div>
                <h2 className="text-2xl font-bold">{t("dashboard.title")}</h2>
                <p className="text-sm text-muted-foreground">
                    {t("dashboard.subtitle")}
                </p>
            </div>

            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t("stats.totalOrganizations")}
                        </CardTitle>
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                            <div className="text-3xl font-bold">
                                {stats?.total_organizations ?? 0}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t("stats.totalUsers")}
                        </CardTitle>
                        <Users className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                            <div className="text-3xl font-bold">
                                {stats?.total_users ?? 0}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent signups */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t("recentSignups.title")}</CardTitle>
                        <CardDescription>
                            {t("recentSignups.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : stats && stats.recent_users.length > 0 ? (
                            <ul className="divide-y">
                                {stats.recent_users.map((recentUser) => (
                                    <li
                                        key={recentUser.id}
                                        className="flex items-center justify-between gap-3 py-3"
                                    >
                                        <span className="truncate text-sm font-medium">
                                            {recentUser.email ??
                                                t("recentSignups.noEmail")}
                                        </span>
                                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                                            {formatDate(recentUser.created_at)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="py-4 text-sm text-muted-foreground">
                                {t("recentSignups.empty")}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* User Impersonation */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t("impersonation.title")}</CardTitle>
                        <CardDescription>
                            {t("impersonation.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleImpersonate} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="userId">
                                    {t("impersonation.providerUserId")}
                                </Label>
                                <Input
                                    id="userId"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    placeholder={t(
                                        "impersonation.providerUserIdPlaceholder"
                                    )}
                                    required
                                />
                            </div>

                            {error && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="me-2 h-4 w-4 animate-spin" />
                                        {t("impersonation.processing")}
                                    </>
                                ) : (
                                    <>
                                        <UserCog className="me-2 h-4 w-4" />
                                        {t("impersonation.submit")}
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Quick links */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Building2 className="h-4 w-4" />
                            {t("quickLinks.organizations.title")}
                        </CardTitle>
                        <CardDescription>
                            {t("quickLinks.organizations.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/admin/organizations">
                            <Button variant="outline" className="w-full">
                                {t("quickLinks.open")}
                                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Users className="h-4 w-4" />
                            {t("quickLinks.users.title")}
                        </CardTitle>
                        <CardDescription>
                            {t("quickLinks.users.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/admin/users">
                            <Button variant="outline" className="w-full">
                                {t("quickLinks.open")}
                                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Mail className="h-4 w-4" />
                            {t("quickLinks.mail.title")}
                        </CardTitle>
                        <CardDescription>
                            {t("quickLinks.mail.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/admin/mail">
                            <Button variant="outline" className="w-full">
                                {t("quickLinks.open")}
                                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <List className="h-4 w-4" />
                            {t("quickLinks.mailLog.title")}
                        </CardTitle>
                        <CardDescription>
                            {t("quickLinks.mailLog.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/admin/mail-log">
                            <Button variant="outline" className="w-full">
                                {t("quickLinks.open")}
                                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ShieldCheck className="h-4 w-4" />
                            {t("quickLinks.security.title")}
                        </CardTitle>
                        <CardDescription>
                            {t("quickLinks.security.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/admin/security">
                            <Button variant="outline" className="w-full">
                                {t("quickLinks.open")}
                                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
