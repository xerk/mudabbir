"use client";

import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  addTeamMemberApiV1OrganizationsTeamsTeamIdMembersPost,
  createTeamApiV1OrganizationsTeamsPost,
  deleteTeamApiV1OrganizationsTeamsTeamIdDelete,
  listMembersApiV1OrganizationsMembersGet,
  listTeamMembersApiV1OrganizationsTeamsTeamIdMembersGet,
  listTeamsApiV1OrganizationsTeamsGet,
  removeTeamMemberApiV1OrganizationsTeamsTeamIdMembersUserIdDelete,
  updateTeamApiV1OrganizationsTeamsTeamIdPut,
} from "@/client/sdk.gen";
import type {
  OrganizationMemberResponse,
  TeamMemberResponse,
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
import { Card, CardContent } from "@/components/ui/card";
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

export default function TeamsPage() {
  const t = useTranslations("teams");
  const { user, loading: authLoading } = useAuth();

  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeamResponse | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<TeamResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Manage members dialog
  const [membersTeam, setMembersTeam] = useState<TeamResponse | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberResponse[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrganizationMemberResponse[]>(
    [],
  );
  const [membersLoading, setMembersLoading] = useState(false);
  const [addSelection, setAddSelection] = useState<string>("");
  const [addingMember, setAddingMember] = useState(false);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTeamsApiV1OrganizationsTeamsGet();
      if (res.error) {
        toast.error(detailFromError(res.error, t("errors.load")));
        return;
      }
      setTeams(res.data ?? []);
    } catch {
      toast.error(t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (authLoading || !user) return;
    void loadTeams();
  }, [authLoading, user, loadTeams]);

  function openCreate() {
    setEditTarget(null);
    setName("");
    setDescription("");
    setFormOpen(true);
  }

  function openEdit(team: TeamResponse) {
    setEditTarget(team);
    setName(team.name);
    setDescription(team.description ?? "");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error(t("errors.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        const res = await updateTeamApiV1OrganizationsTeamsTeamIdPut({
          path: { team_id: editTarget.id },
          body: { name: name.trim(), description: description.trim() || null },
        });
        if (res.error) {
          toast.error(detailFromError(res.error, t("errors.update")));
          return;
        }
        toast.success(t("toast.updated"));
      } else {
        const res = await createTeamApiV1OrganizationsTeamsPost({
          body: { name: name.trim(), description: description.trim() || null },
        });
        if (res.error) {
          toast.error(detailFromError(res.error, t("errors.create")));
          return;
        }
        toast.success(t("toast.created"));
      }
      setFormOpen(false);
      void loadTeams();
    } catch {
      toast.error(editTarget ? t("errors.update") : t("errors.create"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteTeamApiV1OrganizationsTeamsTeamIdDelete({
        path: { team_id: deleteTarget.id },
      });
      if (res.error) {
        toast.error(detailFromError(res.error, t("errors.delete")));
        return;
      }
      setTeams((prev) => prev.filter((tm) => tm.id !== deleteTarget.id));
      toast.success(t("toast.deleted"));
      setDeleteTarget(null);
    } catch {
      toast.error(t("errors.delete"));
    } finally {
      setDeleting(false);
    }
  }

  const loadTeamMembers = useCallback(
    async (team: TeamResponse) => {
      setMembersLoading(true);
      try {
        const [teamRes, orgRes] = await Promise.all([
          listTeamMembersApiV1OrganizationsTeamsTeamIdMembersGet({
            path: { team_id: team.id },
          }),
          listMembersApiV1OrganizationsMembersGet(),
        ]);
        if (teamRes.error) {
          toast.error(detailFromError(teamRes.error, t("errors.loadMembers")));
        } else {
          setTeamMembers(teamRes.data ?? []);
        }
        if (!orgRes.error) {
          setOrgMembers(orgRes.data ?? []);
        }
      } catch {
        toast.error(t("errors.loadMembers"));
      } finally {
        setMembersLoading(false);
      }
    },
    [t],
  );

  function openMembers(team: TeamResponse) {
    setMembersTeam(team);
    setAddSelection("");
    setTeamMembers([]);
    void loadTeamMembers(team);
  }

  async function handleAddMember() {
    if (!membersTeam || !addSelection) return;
    setAddingMember(true);
    try {
      const res = await addTeamMemberApiV1OrganizationsTeamsTeamIdMembersPost({
        path: { team_id: membersTeam.id },
        body: { user_id: Number(addSelection) },
      });
      if (res.error) {
        toast.error(detailFromError(res.error, t("errors.addMember")));
        return;
      }
      toast.success(t("toast.memberAdded"));
      setAddSelection("");
      void loadTeamMembers(membersTeam);
    } catch {
      toast.error(t("errors.addMember"));
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(member: TeamMemberResponse) {
    if (!membersTeam) return;
    try {
      const res =
        await removeTeamMemberApiV1OrganizationsTeamsTeamIdMembersUserIdDelete({
          path: { team_id: membersTeam.id, user_id: member.user_id },
        });
      if (res.error) {
        toast.error(detailFromError(res.error, t("errors.removeMember")));
        return;
      }
      setTeamMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
      toast.success(t("toast.memberRemoved"));
    } catch {
      toast.error(t("errors.removeMember"));
    }
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const availableToAdd = orgMembers.filter(
    (om) => !teamMembers.some((tm) => tm.user_id === om.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="me-2 h-4 w-4" />
          {t("actions.create")}
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
          ) : teams.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t("list.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t("create.nameLabel")}</TableHead>
                  <TableHead className="text-start">
                    {t("create.descriptionLabel")}
                  </TableHead>
                  <TableHead className="text-start">{t("list.created")}</TableHead>
                  <TableHead className="text-end">{t("members.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="text-start font-medium">
                      {team.name}
                    </TableCell>
                    <TableCell className="text-start text-muted-foreground">
                      {team.description || "—"}
                    </TableCell>
                    <TableCell className="text-start text-muted-foreground">
                      {formatDate(team.created_at)}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMembers(team)}
                          title={t("actions.manageMembers")}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(team)}
                          title={t("actions.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive/90"
                          onClick={() => setDeleteTarget(team)}
                          title={t("actions.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? t("edit.title") : t("create.title")}
            </DialogTitle>
            <DialogDescription>
              {editTarget ? t("edit.description") : t("create.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">{t("create.nameLabel")}</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("create.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-description">
                {t("create.descriptionLabel")}
              </Label>
              <Input
                id="team-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("create.descriptionPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              {t("actions.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? t("actions.saving")
                : editTarget
                  ? t("edit.submit")
                  : t("create.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete.description", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage members dialog */}
      <Dialog
        open={!!membersTeam}
        onOpenChange={(open) => {
          if (!open) setMembersTeam(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("members.title", { name: membersTeam?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("members.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("members.addLabel")}</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={addSelection}
                  onValueChange={setAddSelection}
                  disabled={availableToAdd.length === 0}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("members.addPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableToAdd.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.email ?? t("members.unknownEmail")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddMember}
                  disabled={!addSelection || addingMember}
                >
                  {t("actions.add")}
                </Button>
              </div>
              {availableToAdd.length === 0 && !membersLoading ? (
                <p className="text-xs text-muted-foreground">
                  {t("members.noAvailable")}
                </p>
              ) : null}
            </div>

            {membersLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : teamMembers.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground">
                {t("members.empty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">
                      {t("members.email")}
                    </TableHead>
                    <TableHead className="text-start">
                      {t("members.role")}
                    </TableHead>
                    <TableHead className="text-end">
                      {t("members.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-start font-medium">
                        {m.email ?? t("members.unknownEmail")}
                      </TableCell>
                      <TableCell className="text-start text-muted-foreground">
                        {m.role}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive/90"
                          onClick={() => handleRemoveMember(m)}
                          title={t("actions.remove")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
