"use client";

import { ArrowRight, BarChart3, KeyRound, Megaphone, Mic, PhoneCall, Settings, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
    getCampaignsApiV1CampaignGet,
    getUsageHistoryApiV1OrganizationsUsageRunsGet,
    getWorkflowCountApiV1WorkflowCountGet,
    listRecordingsApiV1WorkflowRecordingsGet,
} from '@/client/sdk.gen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

type StatKey = 'statVoiceAgents' | 'statCampaigns' | 'statRecordings' | 'statAgentRuns';

export default function OverviewPage() {
    const { user, provider, getAccessToken } = useAuth();
    const isOSSMode = provider !== 'stack';
    const t = useTranslations('overview');

    const stats = [
        { key: 'statVoiceAgents', icon: Mic },
        { key: 'statCampaigns', icon: Megaphone },
        { key: 'statRecordings', icon: PhoneCall },
        { key: 'statAgentRuns', icon: BarChart3 },
    ] as const;

    const [counts, setCounts] = useState<Partial<Record<StatKey, number>>>({});
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        void (async () => {
            try {
                const token = await getAccessToken();
                const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
                const [wf, campaigns, recordings, runs] = await Promise.all([
                    getWorkflowCountApiV1WorkflowCountGet({ headers }),
                    getCampaignsApiV1CampaignGet({ headers }),
                    listRecordingsApiV1WorkflowRecordingsGet({ headers }),
                    getUsageHistoryApiV1OrganizationsUsageRunsGet({ headers, query: { page: 1, limit: 1 } }),
                ]);
                if (!active) return;
                setCounts({
                    statVoiceAgents: wf.data?.total,
                    statCampaigns: campaigns.data?.campaigns?.length,
                    statRecordings: recordings.data?.total,
                    statAgentRuns: runs.data?.total_count,
                });
            } catch {
                // Leave counts empty — the cards fall back to the "—" placeholder.
            } finally {
                if (active) setStatsLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [getAccessToken]);

    const quickActions = [
        { key: 'voiceAgents', href: '/workflow', icon: Mic },
        { key: 'campaigns', href: '/campaigns', icon: Megaphone },
        { key: 'recordings', href: '/recordings', icon: PhoneCall },
        { key: 'agentRuns', href: '/usage', icon: BarChart3 },
        { key: 'developers', href: '/api-keys', icon: KeyRound },
        { key: 'settings', href: '/settings', icon: Settings },
    ] as const;

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mx-auto max-w-5xl space-y-8">
                {/* Welcome header */}
                <header className="flex flex-col gap-4 rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                    <div className="space-y-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            <Sparkles className="size-3.5" aria-hidden="true" />
                            {t('badge')}
                        </span>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            {isOSSMode
                                ? t('welcomeOSS')
                                : user?.displayName
                                    ? t('welcomeUser', { name: user.displayName.split(' ')[0] })
                                    : t('welcomeGeneric')}
                        </h1>
                        <p className="max-w-prose text-muted-foreground">
                            {isOSSMode ? t('descriptionOSS') : t('descriptionUser')}
                        </p>
                    </div>
                </header>

                {/* Summary stats */}
                <section aria-labelledby="overview-stats-heading">
                    <h2 id="overview-stats-heading" className="sr-only">
                        {t('statsHeading')}
                    </h2>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {stats.map(({ key, icon: Icon }) => (
                            <Card key={key} className="border-dashed">
                                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                                    <CardDescription className="text-xs font-medium">
                                        {t(`${key}Label`)}
                                    </CardDescription>
                                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                                </CardHeader>
                                <CardContent>
                                    {statsLoading ? (
                                        <Skeleton className="h-8 w-12" />
                                    ) : (
                                        <p className="text-2xl font-semibold tabular-nums">
                                            {counts[key] ?? t(`${key}Value`)}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* Quick actions */}
                <section aria-labelledby="overview-actions-heading" className="space-y-4">
                    <div className="space-y-1">
                        <h2 id="overview-actions-heading" className="text-xl font-semibold tracking-tight">
                            {t('quickActionsTitle')}
                        </h2>
                        <p className="text-sm text-muted-foreground">{t('quickActionsDescription')}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {quickActions.map(({ key, href, icon: Icon }) => (
                            <Link
                                key={key}
                                href={href}
                                className="group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <Card className="h-full transition-colors hover:border-primary/50 hover:bg-accent/40">
                                    <CardHeader>
                                        <div className="flex items-center gap-3">
                                            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                                <Icon className="size-5" aria-hidden="true" />
                                            </span>
                                            <CardTitle className="text-base">{t(`${key}Title`)}</CardTitle>
                                        </div>
                                        <CardDescription className="mt-2">
                                            {t(`${key}Description`)}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                                            {t('open')}
                                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
                                        </span>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Resources */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('resourcesTitle')}</CardTitle>
                        <CardDescription>{t('resourcesDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-4">
                            <Button asChild variant="outline">
                                <a href="https://docs.dograh.com" target="_blank" rel="noopener noreferrer">
                                    {t('documentation')}
                                </a>
                            </Button>
                            <Button asChild variant="outline">
                                <a
                                    href="https://github.com/xerk/mudabbir/issues"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {t('reportAnIssue')}
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
