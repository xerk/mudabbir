"use client";

import { Building2, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createOrganizationApiV1AdminOrganizationsPost,
  deleteOrganizationApiV1AdminOrganizationsOrgIdDelete,
  listOrganizationsApiV1AdminOrganizationsGet,
  updateOrganizationApiV1AdminOrganizationsOrgIdPut,
} from "@/client/sdk.gen";
import type { AdminOrganizationResponse } from "@/client/types.gen";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function AdminOrganizationsPage() {
  const t = useTranslations("adminOrgs");
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const hasFetched = useRef(false);

  const [organizations, setOrganizations] = useState<AdminOrganizationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<AdminOrganizationResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<AdminOrganizationResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading || !user || hasFetched.current) return;
    hasFetched.current = true;
    void fetchOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function fetchOrganizations() {
    setLoading(true);
    try {
      const result = await listOrganizationsApiV1AdminOrganizationsGet();
      if (result.error || !result.data) {
        toast.error(detailFromError(result.error, t("toasts.loadError")));
        return;
      }
      setOrganizations(result.data);
    } catch {
      toast.error(t("toasts.loadError"));
    } finally {
      setLoading(false);
    }
  }

  function displayName(org: AdminOrganizationResponse): string {
    return org.name?.trim() || t("workspaceFallback", { id: org.id });
  }

  function formatDate(value: string): string {
    return new Date(value).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter((org) => displayName(org).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizations, search]);

  async function handleCreate() {
    const name = createName.trim();
    if (!name) {
      toast.error(t("toasts.nameRequired"));
      return;
    }
    setCreating(true);
    try {
      const result = await createOrganizationApiV1AdminOrganizationsPost({
        body: { name },
      });
      if (result.error || !result.data) {
        toast.error(detailFromError(result.error, t("toasts.createError")));
        return;
      }
      toast.success(t("toasts.createSuccess"));
      setIsCreateOpen(false);
      setCreateName("");
      void fetchOrganizations();
    } catch {
      toast.error(t("toasts.createError"));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(org: AdminOrganizationResponse) {
    setEditTarget(org);
    setEditName(org.name ?? "");
    setEditLogoUrl(org.logo_url ?? "");
  }

  async function handleUpdate() {
    if (!editTarget) return;
    const name = editName.trim();
    if (!name) {
      toast.error(t("toasts.nameRequired"));
      return;
    }
    setUpdating(true);
    try {
      const result = await updateOrganizationApiV1AdminOrganizationsOrgIdPut({
        path: { org_id: editTarget.id },
        body: { name, logo_url: editLogoUrl.trim() || null },
      });
      if (result.error || !result.data) {
        toast.error(detailFromError(result.error, t("toasts.updateError")));
        return;
      }
      toast.success(t("toasts.updateSuccess"));
      setEditTarget(null);
      void fetchOrganizations();
    } catch {
      toast.error(t("toasts.updateError"));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteOrganizationApiV1AdminOrganizationsOrgIdDelete({
        path: { org_id: deleteTarget.id },
      });
      if (result.error) {
        // 400 with dependent records (or any other error) surfaces its detail here.
        toast.error(detailFromError(result.error, t("toasts.deleteError")));
        return;
      }
      toast.success(t("toasts.deleteSuccess"));
      setDeleteTarget(null);
      void fetchOrganizations();
    } catch {
      toast.error(t("toasts.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t("createButton")}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="ps-9"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.members")}</TableHead>
              <TableHead>{t("columns.created")}</TableHead>
              <TableHead className="text-end">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-end">
                    <Skeleton className="ms-auto h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center">
                  <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  {organizations.length === 0 ? (
                    <>
                      <p className="font-medium">{t("empty.title")}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("empty.description")}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("empty.noResults")}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{displayName(org)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {t("membersCount", { count: org.member_count })}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(org.created_at)}
                  </TableCell>
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <span className="sr-only">{t("actions.open")}</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(org)}>
                          <Pencil className="me-2 h-4 w-4" />
                          {t("actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(org)}
                        >
                          <Trash2 className="me-2 h-4 w-4" />
                          {t("actions.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createDialog.title")}</DialogTitle>
            <DialogDescription>{t("createDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="create-org-name">{t("createDialog.nameLabel")}</Label>
            <Input
              id="create-org-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={t("createDialog.namePlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t("createDialog.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {t("createDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editDialog.title")}</DialogTitle>
            <DialogDescription>{t("editDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-org-name">{t("editDialog.nameLabel")}</Label>
              <Input
                id="edit-org-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("editDialog.namePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-org-logo">{t("editDialog.logoLabel")}</Label>
              <Input
                id="edit-org-logo"
                value={editLogoUrl}
                onChange={(e) => setEditLogoUrl(e.target.value)}
                placeholder={t("editDialog.logoPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              {t("editDialog.cancel")}
            </Button>
            <Button onClick={handleUpdate} disabled={updating}>
              {t("editDialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t("deleteDialog.description", { name: displayName(deleteTarget) })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
