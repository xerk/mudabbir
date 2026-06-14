"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  inviteMemberApiV1OrganizationsMembersInvitePost,
  listInvitationsApiV1OrganizationsInvitationsGet,
  listMembersApiV1OrganizationsMembersGet,
  listTeamsApiV1OrganizationsTeamsGet,
  removeMemberApiV1OrganizationsMembersUserIdDelete,
  revokeInvitationApiV1OrganizationsInvitationsInvitationIdDelete,
  updateMemberRoleApiV1OrganizationsMembersUserIdRolePut,
} from "@/client/sdk.gen";
import type {
  InvitationResponse,
  OrganizationMemberResponse,
  TeamResponse,
} from "@/client/types.gen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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

const ROLES = ["owner", "admin", "member"] as const;
const NO_TEAM = "__none__";

export default function MembersPage() {
  const t = useTranslations("members");
  const { user, loading: authLoading } = useAuth();

  const [members, setMembers] = useState<OrganizationMemberResponse[]>([]);
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [inviteTeam, setInviteTeam] = useState<string>(NO_TEAM);
  const [inviting, setInviting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<InvitationResponse | null>(
    null,
  );

  // Remove confirm state
  const [removeTarget, setRemoveTarget] =
    useState<OrganizationMemberResponse | null>(null);
  const [removing, setRemoving] = useState(false);

  const currentEmail = (() => {
    if (!user) return "";
    if ("primaryEmail" in user && user.primaryEmail) {
      return user.primaryEmail.toLowerCase();
    }
    if ("email" in user && user.email) {
      return user.email.toLowerCase();
    }
    return "";
  })();

  const inviteLink = useCallback(
    (acceptPath: string) => {
      if (typeof window === "undefined") return acceptPath;
      return `${window.location.origin}${acceptPath}`;
    },
    [],
  );

  const copyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t("toast.linkCopied"));
      } catch {
        toast.error(t("toast.copyFailed"));
      }
    },
    [t],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, invitesRes, teamsRes] = await Promise.all([
        listMembersApiV1OrganizationsMembersGet(),
        listInvitationsApiV1OrganizationsInvitationsGet(),
        listTeamsApiV1OrganizationsTeamsGet(),
      ]);

      if (membersRes.error) {
        toast.error(detailFromError(membersRes.error, t("errors.load")));
      } else {
        setMembers(membersRes.data ?? []);
      }

      if (!invitesRes.error) {
        setInvitations(invitesRes.data ?? []);
      }

      if (!teamsRes.error) {
        setTeams(teamsRes.data ?? []);
      }
    } catch {
      toast.error(t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (authLoading || !user) return;
    void loadData();
  }, [authLoading, user, loadData]);

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      toast.error(t("errors.emailRequired"));
      return;
    }
    setInviting(true);
    try {
      const res = await inviteMemberApiV1OrganizationsMembersInvitePost({
        body: {
          email: inviteEmail.trim(),
          role: inviteRole,
          team_id: inviteTeam === NO_TEAM ? null : Number(inviteTeam),
        },
      });
      if (res.error || !res.data) {
        toast.error(detailFromError(res.error, t("errors.invite")));
        return;
      }
      setCreatedInvite(res.data);
      setInviteEmail("");
      setInviteRole("member");
      setInviteTeam(NO_TEAM);
      toast.success(t("toast.invited"));
      void loadData();
    } catch {
      toast.error(t("errors.invite"));
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(
    member: OrganizationMemberResponse,
    role: string,
  ) {
    try {
      const res = await updateMemberRoleApiV1OrganizationsMembersUserIdRolePut({
        path: { user_id: member.id },
        body: { role },
      });
      if (res.error) {
        toast.error(detailFromError(res.error, t("errors.updateRole")));
        return;
      }
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role } : m)),
      );
      toast.success(t("toast.roleUpdated"));
    } catch {
      toast.error(t("errors.updateRole"));
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await removeMemberApiV1OrganizationsMembersUserIdDelete({
        path: { user_id: removeTarget.id },
      });
      if (res.error) {
        toast.error(detailFromError(res.error, t("errors.remove")));
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id));
      toast.success(t("toast.memberRemoved"));
      setRemoveTarget(null);
    } catch {
      toast.error(t("errors.remove"));
    } finally {
      setRemoving(false);
    }
  }

  async function handleRevoke(invitation: InvitationResponse) {
    try {
      const res =
        await revokeInvitationApiV1OrganizationsInvitationsInvitationIdDelete({
          path: { invitation_id: invitation.id },
        });
      if (res.error) {
        toast.error(detailFromError(res.error, t("errors.revoke")));
        return;
      }
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      toast.success(t("toast.invitationRevoked"));
    } catch {
      toast.error(t("errors.revoke"));
    }
  }

  function roleLabel(role: string) {
    if (role === "owner" || role === "admin" || role === "member") {
      return t(`roles.${role}`);
    }
    return role;
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function isSelf(member: OrganizationMemberResponse) {
    return (member.email ?? "").toLowerCase() === currentEmail && !!currentEmail;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t("actions.invite")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t("table.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("table.email")}
                  </TableHead>
                  <TableHead className="text-start">{t("table.role")}</TableHead>
                  <TableHead className="text-start">
                    {t("table.joined")}
                  </TableHead>
                  <TableHead className="text-end">
                    {t("table.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const self = isSelf(member);
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="text-start font-medium">
                        {member.email ?? t("table.unknownEmail")}
                        {self ? (
                          <span className="ms-2 text-xs text-muted-foreground">
                            ({t("table.you")})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-start">
                        <Select
                          value={member.role}
                          onValueChange={(role) =>
                            handleRoleChange(member, role)
                          }
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {roleLabel(role)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-start text-muted-foreground">
                        {formatDate(member.joined)}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={self}
                          title={self ? t("remove.selfBlocked") : undefined}
                          className="text-destructive hover:text-destructive/90"
                          onClick={() => setRemoveTarget(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("invitations.title")}</CardTitle>
          <CardDescription>{t("invitations.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-12 w-full" />
          ) : invitations.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground">
              {t("invitations.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">
                    {t("table.email")}
                  </TableHead>
                  <TableHead className="text-start">{t("table.role")}</TableHead>
                  <TableHead className="text-start">
                    {t("invitations.expires")}
                  </TableHead>
                  <TableHead className="text-end">
                    {t("table.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-start font-medium">
                      {inv.email}
                    </TableCell>
                    <TableCell className="text-start">
                      {roleLabel(inv.role)}
                    </TableCell>
                    <TableCell className="text-start text-muted-foreground">
                      {inv.expires_at
                        ? formatDate(inv.expires_at)
                        : t("invitations.noExpiry")}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyText(inviteLink(inv.accept_path))
                          }
                        >
                          <Copy className="me-1 h-4 w-4" />
                          {t("actions.copyLink")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive/90"
                          onClick={() => handleRevoke(inv)}
                        >
                          {t("actions.revoke")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) setCreatedInvite(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("invite.title")}</DialogTitle>
            <DialogDescription>{t("invite.description")}</DialogDescription>
          </DialogHeader>

          {createdInvite ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("invite.successDescription")}
              </p>
              <div className="space-y-2">
                <Label>{t("invite.linkLabel")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={inviteLink(createdInvite.accept_path)}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyText(inviteLink(createdInvite.accept_path))
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setInviteOpen(false);
                    setCreatedInvite(null);
                  }}
                >
                  {t("invite.done")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t("invite.emailLabel")}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t("invite.emailPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("invite.roleLabel")}</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("invite.teamLabel")}</Label>
                <Select value={inviteTeam} onValueChange={setInviteTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("invite.teamPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEAM}>{t("invite.noTeam")}</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={String(team.id)}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviting}
                >
                  {t("actions.cancel")}
                </Button>
                <Button onClick={handleInvite} disabled={inviting}>
                  {inviting ? t("invite.submitting") : t("invite.submit")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("remove.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("remove.description", {
                email: removeTarget?.email ?? t("table.unknownEmail"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                void handleRemove();
              }}
            >
              {t("remove.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
