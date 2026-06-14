"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { acceptInvitationApiV1OrganizationsInvitationsAcceptPost } from "@/client/sdk.gen";
import type { OrganizationSummary } from "@/client/types.gen";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AcceptInvitePage() {
  const t = useTranslations("members");
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";

  const [accepting, setAccepting] = useState(false);
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [errored, setErrored] = useState(false);

  async function handleAccept() {
    if (!token) {
      setErrored(true);
      return;
    }
    setAccepting(true);
    try {
      const res = await acceptInvitationApiV1OrganizationsInvitationsAcceptPost({
        body: { token },
      });
      if (res.error || !res.data) {
        setErrored(true);
        return;
      }
      setOrg(res.data);
      setAccepted(true);
      router.push("/");
    } catch {
      setErrored(true);
    } finally {
      setAccepting(false);
    }
  }

  const orgName = org?.name ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        {!token ? (
          <>
            <CardHeader>
              <div className="mb-2 flex justify-center">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <CardTitle className="text-center">
                {t("accept.invalidTitle")}
              </CardTitle>
              <CardDescription className="text-center">
                {t("accept.missingToken")}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button asChild variant="outline">
                <Link href="/">{t("accept.backHome")}</Link>
              </Button>
            </CardFooter>
          </>
        ) : errored ? (
          <>
            <CardHeader>
              <div className="mb-2 flex justify-center">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <CardTitle className="text-center">
                {t("accept.invalidTitle")}
              </CardTitle>
              <CardDescription className="text-center">
                {t("accept.invalidDescription")}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button asChild variant="outline">
                <Link href="/">{t("accept.backHome")}</Link>
              </Button>
            </CardFooter>
          </>
        ) : accepted ? (
          <>
            <CardHeader>
              <div className="mb-2 flex justify-center">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-center">
                {t("accept.successTitle")}
              </CardTitle>
              <CardDescription className="text-center">
                {t("accept.successDescription", { org: orgName })}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button asChild>
                <Link href="/">{t("accept.goHome")}</Link>
              </Button>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-center">
                {t("accept.title")}
              </CardTitle>
              <CardDescription className="text-center">
                {t("accept.description")}
              </CardDescription>
            </CardHeader>
            <CardContent />
            <CardFooter className="justify-center">
              <Button onClick={handleAccept} disabled={accepting}>
                {accepting ? t("accept.accepting") : t("accept.accept")}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
