"use client";

import { Loader2, LogIn, MoreHorizontal, Search, Shield, ShieldOff, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    deleteUserApiV1AdminUsersUserIdDelete,
    listUsersApiV1AdminUsersGet,
    setUserSuperuserApiV1AdminUsersUserIdSuperuserPut,
} from "@/client/sdk.gen";
import type { AdminUserResponse } from "@/client/types.gen";
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { detailFromError } from "@/lib/apiError";
import { impersonateAsSuperadmin } from "@/lib/utils";

export default function AdminUsersPage() {
    const t = useTranslations("adminUsers");
    const { user, getAccessToken } = useAuth();

    const [users, setUsers] = useState<AdminUserResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [pendingUserId, setPendingUserId] = useState<number | null>(null);
    const [userToDelete, setUserToDelete] = useState<AdminUserResponse | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchUsers = useCallback(async () => {
        try {
            setIsLoading(true);
            const accessToken = await getAccessToken();
            const result = await listUsersApiV1AdminUsersGet({
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (result.error || !result.data) {
                toast.error(detailFromError(result.error, t("toasts.loadFailed")));
                return;
            }

            setUsers(result.data);
        } catch (err) {
            toast.error(detailFromError(err, t("toasts.loadFailed")));
        } finally {
            setIsLoading(false);
        }
    }, [getAccessToken, t]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return users;
        return users.filter((u) => (u.email ?? "").toLowerCase().includes(query));
    }, [users, search]);

    const handleToggleSuperuser = async (target: AdminUserResponse) => {
        const nextValue = !target.is_superuser;
        try {
            setPendingUserId(target.id);
            const accessToken = await getAccessToken();
            const result = await setUserSuperuserApiV1AdminUsersUserIdSuperuserPut({
                path: { user_id: target.id },
                body: { is_superuser: nextValue },
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (result.error || !result.data) {
                toast.error(detailFromError(result.error, t("toasts.superuserFailed")));
                return;
            }

            toast.success(nextValue ? t("toasts.superuserGranted") : t("toasts.superuserRevoked"));
            await fetchUsers();
        } catch (err) {
            toast.error(detailFromError(err, t("toasts.superuserFailed")));
        } finally {
            setPendingUserId(null);
        }
    };

    const handleImpersonate = async (target: AdminUserResponse) => {
        try {
            setPendingUserId(target.id);
            const accessToken = await getAccessToken();
            if (!accessToken) {
                throw new Error("Missing admin access token");
            }
            await impersonateAsSuperadmin({
                accessToken,
                userId: target.id,
                redirectPath: "/workflow",
                openInNewTab: true,
            });
        } catch (err) {
            toast.error(detailFromError(err, t("toasts.impersonateFailed")));
        } finally {
            setPendingUserId(null);
        }
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        try {
            setIsDeleting(true);
            const accessToken = await getAccessToken();
            const result = await deleteUserApiV1AdminUsersUserIdDelete({
                path: { user_id: userToDelete.id },
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (result.error) {
                toast.error(detailFromError(result.error, t("toasts.deleteFailed")));
                return;
            }

            toast.success(t("toasts.deleted"));
            setUserToDelete(null);
            await fetchUsers();
        } catch (err) {
            toast.error(detailFromError(err, t("toasts.deleteFailed")));
        } finally {
            setIsDeleting(false);
        }
    };

    const formatDate = (value: string) =>
        new Date(value).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });

    return (
        <main className="container mx-auto p-6 space-y-6 max-w-5xl">
            <div>
                <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
                <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("search.placeholder")}
                    className="ps-9"
                />
            </div>

            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("columns.email")}</TableHead>
                            <TableHead>{t("columns.superAdmin")}</TableHead>
                            <TableHead>{t("columns.organizations")}</TableHead>
                            <TableHead>{t("columns.created")}</TableHead>
                            <TableHead className="text-end">{t("columns.actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [1, 2, 3, 4, 5].map((i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell className="text-end"><Skeleton className="h-8 w-8 ms-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <Users className="h-12 w-12 text-muted-foreground mb-4" />
                                        <p className="font-medium">{t("empty.title")}</p>
                                        <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map((u) => {
                                const isPending = pendingUserId === u.id;
                                const isSelf = user?.id != null && String(user.id) === String(u.id);
                                return (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">
                                            {u.email ?? (
                                                <span className="text-muted-foreground">{t("noEmail")}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {u.is_superuser ? (
                                                <Badge variant="default">{t("badge.yes")}</Badge>
                                            ) : (
                                                <Badge variant="secondary">{t("badge.no")}</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>{u.organization_count}</TableCell>
                                        <TableCell>{formatDate(u.created_at)}</TableCell>
                                        <TableCell className="text-end">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={isPending}>
                                                        {isPending ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        )}
                                                        <span className="sr-only">{t("actions.open")}</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>{t("actions.label")}</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleToggleSuperuser(u)}>
                                                        {u.is_superuser ? (
                                                            <>
                                                                <ShieldOff className="me-2 h-4 w-4" />
                                                                {t("actions.revokeSuperAdmin")}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Shield className="me-2 h-4 w-4" />
                                                                {t("actions.grantSuperAdmin")}
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleImpersonate(u)}>
                                                        <LogIn className="me-2 h-4 w-4" />
                                                        {t("actions.impersonate")}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        disabled={isSelf}
                                                        onClick={() => setUserToDelete(u)}
                                                    >
                                                        <Trash2 className="me-2 h-4 w-4" />
                                                        {t("actions.delete")}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog
                open={userToDelete !== null}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) setUserToDelete(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("deleteDialog.description", {
                                email: userToDelete?.email ?? t("noEmail"),
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            {t("deleteDialog.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                            {t("deleteDialog.confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}
