"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  listMyOrganizationsApiV1OrganizationsMineGet,
  selectOrganizationApiV1OrganizationsSelectPost,
} from "@/client/sdk.gen";
import { useAuth } from "@/lib/auth";

/**
 * Org workspace segment. Resolves the {slug} in the URL to one of the user's
 * organizations, makes it the active org, and stores it in the `org_slug`
 * cookie so middleware can keep bare paths (/workflow) redirected to
 * /{slug}/workflow. Unknown slug → bounce to the user's first workspace.
 */
export default function SlugLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { user, loading, getAccessToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    void (async () => {
      try {
        const token = await getAccessToken();
        const res = await listMyOrganizationsApiV1OrganizationsMineGet({
          headers: { Authorization: `Bearer ${token}` },
        });
        const orgs = res.data?.organizations ?? [];
        const match = orgs.find((o) => o.slug === slug);

        if (!match) {
          const fallback = orgs[0]?.slug;
          router.replace(fallback ? `/${fallback}/overview` : "/auth/login");
          return;
        }

        document.cookie = `org_slug=${slug}; path=/; max-age=31536000; samesite=lax`;
        if (res.data?.selected_organization_id !== match.id) {
          await selectOrganizationApiV1OrganizationsSelectPost({
            body: { organization_id: match.id },
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        if (active) setReady(true);
      } catch {
        // Fail open so a transient error doesn't trap the user on a spinner.
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, user, loading, getAccessToken, router]);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
