import { isNextRouterError } from "next/dist/client/components/is-next-router-error";
import { redirect } from "next/navigation";

import { getWorkflowCountApiV1WorkflowCountGet, listMyOrganizationsApiV1OrganizationsMineGet } from "@/client/sdk.gen";
import { getServerAccessToken,getServerAuthProvider, getServerUser } from "@/lib/auth/server";
import logger from '@/lib/logger';
import { getRedirectUrl } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export default async function AfterSignInPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string }>;
}) {
    const { next } = await searchParams;
    logger.debug('[AfterSignInPage] Starting after-sign-in page');
    const authProvider = await getServerAuthProvider();
    logger.debug('[AfterSignInPage] Auth provider:', authProvider);
    logger.debug('[AfterSignInPage] Getting server user...');
    const user = await getServerUser();
    logger.debug('[AfterSignInPage] Got user:', { hasUser: !!user, userId: user?.id });

    if (authProvider === 'stack' && user && 'getAuthJson' in user) {
        logger.debug('[AfterSignInPage] Stack user detected, getting auth token...');
        const token = await user.getAuthJson();
        logger.debug('[AfterSignInPage] Got token:', { hasToken: !!token?.accessToken });
        const permissions = 'listPermissions' in user && 'selectedTeam' in user
            ? await user.listPermissions(user.selectedTeam!) ?? []
            : [];
        logger.debug('[AfterSignInPage] Got permissions:', { count: permissions.length });
        const redirectUrl = await getRedirectUrl(token?.accessToken ?? "", permissions);
        logger.debug('[AfterSignInPage] Redirecting to:', redirectUrl);
        redirect(redirectUrl);
    }

    // For local provider or if user is not available, check for existing workflows
    logger.debug('[AfterSignInPage] Checking for existing workflows before fallback');

    try {
        const accessToken = await getServerAccessToken();
        if (accessToken) {
            // Resolve the active workspace slug for /{slug}/* routing.
            let slug: string | undefined;
            try {
                const mine = await listMyOrganizationsApiV1OrganizationsMineGet({
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const orgs = mine.data?.organizations ?? [];
                slug =
                    orgs.find((o) => o.id === mine.data?.selected_organization_id)?.slug ??
                    orgs[0]?.slug ??
                    undefined;
            } catch (err) {
                logger.error('[AfterSignInPage] Failed to resolve workspace slug:', err);
            }
            // An authenticated user always has a workspace; if we couldn't
            // resolve one, send to login rather than loop on bare paths.
            if (!slug) {
                redirect('/auth/login');
            }
            const base = `/${slug}`;

            // Honor an explicit destination (e.g. a direct /workflow/create
            // link captured by middleware), slug-prefixed.
            if (next && next.startsWith('/')) {
                redirect(`${base}${next}`);
            }

            const countResponse = await getWorkflowCountApiV1WorkflowCountGet({
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (countResponse.data && countResponse.data.active > 0) {
                redirect(`${base}/workflow`);
            } else {
                redirect(`${base}/workflow/create`);
            }
        }
    } catch (error) {
        if (isNextRouterError(error)) {
            throw error;
        }
        logger.error('[AfterSignInPage] Error checking workflows:', error);
    }

    // Default fallback — no token/slug resolvable; go to login (never a bare
    // org path, which would loop back through middleware).
    logger.debug('[AfterSignInPage] Final fallback redirect to /auth/login');
    redirect('/auth/login');
}
