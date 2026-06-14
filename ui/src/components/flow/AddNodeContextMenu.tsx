"use client";

import { DirectionProvider } from "@radix-ui/react-direction";
import * as LucideIcons from "lucide-react";
import { Circle, HelpCircle, type LucideIcon, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";

import type { NodeSpec } from "@/client/types.gen";
import { useNodeSpecs } from "@/components/flow/renderer";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { isRtl } from "@/i18n/config";

import { NodeType } from "./types";

const SECTION_ORDER: Array<{ category: NodeSpec["category"]; titleKey: string }> = [
    { category: "trigger", titleKey: "tools.addNode.sections.triggers" },
    { category: "call_node", titleKey: "tools.addNode.sections.agentNodes" },
    { category: "global_node", titleKey: "tools.addNode.sections.globalNodes" },
    { category: "integration", titleKey: "tools.addNode.sections.integrations" },
];

function resolveIcon(name: string): LucideIcon {
    const icons = LucideIcons as unknown as Record<string, LucideIcon>;
    return icons[name] ?? Circle;
}

type Props = {
    children: ReactNode;
    onNodeSelect: (nodeType: NodeType, screenPos?: { x: number; y: number }) => void;
    enabled?: boolean;
};

/**
 * Right-click anywhere on the workflow canvas to add a node at the cursor.
 *
 * Controlled by an explicit cursor position rather than Radix's built-in
 * ContextMenu trigger: that variant only anchored on the first right-click and
 * wouldn't re-anchor on subsequent ones. Here every contextmenu event sets a
 * fresh position and remounts the menu (via `key`), so it always opens where
 * you clicked. Compact category submenus + a "?" tooltip keep it clean.
 */
export function AddNodeContextMenu({ children, onNodeSelect, enabled = true }: Props) {
    const t = useTranslations("flow");
    const dir = isRtl(useLocale()) ? "rtl" : "ltr";
    const { specs } = useNodeSpecs();
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

    const sections = useMemo(
        () =>
            SECTION_ORDER.map(({ category, titleKey }) => ({
                titleKey,
                specs: specs.filter((s) => s.category === category),
            })).filter((s) => s.specs.length > 0),
        [specs],
    );

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!enabled || sections.length === 0) return;
        // Nodes/edges call stopPropagation in their own menus, so this only
        // fires for empty-canvas right-clicks.
        e.preventDefault();
        setPos({ x: e.clientX, y: e.clientY });
    };

    return (
        <DirectionProvider dir={dir}>
            <TooltipProvider delayDuration={150}>
                <div className="contents" onContextMenu={handleContextMenu}>
                    {children}
                </div>

                {pos && (
                    <DropdownMenu
                        key={`${pos.x},${pos.y}`}
                        dir={dir}
                        open
                        onOpenChange={(o) => {
                            if (!o) setPos(null);
                        }}
                    >
                        <DropdownMenuTrigger asChild>
                            <span
                                aria-hidden
                                style={{
                                    position: "fixed",
                                    left: pos.x,
                                    top: pos.y,
                                    width: 0,
                                    height: 0,
                                }}
                            />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52">
                            <DropdownMenuLabel className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                                <Plus className="h-3.5 w-3.5" />
                                {t("tools.addNode.title")}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {sections.map((section) => (
                                <DropdownMenuSub key={section.titleKey}>
                                    <DropdownMenuSubTrigger className="text-sm">
                                        {t(section.titleKey)}
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-56">
                                        {section.specs.map((spec) => {
                                            const Icon = resolveIcon(spec.icon);
                                            return (
                                                <DropdownMenuItem
                                                    key={spec.name}
                                                    className="cursor-pointer p-0"
                                                    onSelect={() => {
                                                        onNodeSelect(
                                                            spec.name as NodeType,
                                                            pos ?? undefined,
                                                        );
                                                        setPos(null);
                                                    }}
                                                >
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex w-full items-center gap-2 px-2 py-1.5">
                                                                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                                <span className="flex-1 truncate text-sm">
                                                                    {spec.display_name}
                                                                </span>
                                                                {spec.description && (
                                                                    <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        {spec.description && (
                                                            <TooltipContent
                                                                side={dir === "rtl" ? "left" : "right"}
                                                                className="max-w-[220px] text-xs leading-snug"
                                                            >
                                                                {spec.description}
                                                            </TooltipContent>
                                                        )}
                                                    </Tooltip>
                                                </DropdownMenuItem>
                                            );
                                        })}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </TooltipProvider>
        </DirectionProvider>
    );
}
