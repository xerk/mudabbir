import * as LucideIcons from 'lucide-react';
import { Circle, ExternalLink, type LucideIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';

import type { NodeSpec } from '@/client/types.gen';
import { useNodeSpecs } from '@/components/flow/renderer';
import { Button } from '@/components/ui/button';

import { NodeType } from './types';

type AddNodePanelProps = {
    isOpen: boolean;
    onClose: () => void;
    onNodeSelect: (nodeType: NodeType) => void;
};

// Section ordering and labels. Drives both the category → section title
// mapping and the rendering order. titleKey resolves against the `flow`
// translation namespace at render time.
const SECTION_ORDER: Array<{ category: NodeSpec['category']; titleKey: string }> = [
    { category: 'trigger', titleKey: 'tools.addNode.sections.triggers' },
    { category: 'call_node', titleKey: 'tools.addNode.sections.agentNodes' },
    { category: 'global_node', titleKey: 'tools.addNode.sections.globalNodes' },
    { category: 'integration', titleKey: 'tools.addNode.sections.integrations' },
];

function resolveIcon(name: string): LucideIcon {
    const icons = LucideIcons as unknown as Record<string, LucideIcon>;
    return icons[name] ?? Circle;
}

function NodeSection({
    title,
    specs,
    onNodeSelect,
}: {
    title: string;
    specs: NodeSpec[];
    onNodeSelect: (nodeType: NodeType) => void;
}) {
    const t = useTranslations('flow');
    if (specs.length === 0) return null;
    // Node labels/descriptions are served by the backend in English. Prefer a
    // localized override when one exists for the node type, else fall back to
    // the backend-provided text (so a new node type still renders sensibly).
    const tx = (name: string, field: 'name' | 'description', fallback: string) => {
        const key = `tools.addNode.nodeSpecs.${name}.${field}`;
        return t.has(key) ? t(key) : fallback;
    };
    return (
        <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
            </h3>
            <div className="space-y-2">
                {specs.map((spec) => {
                    const Icon = resolveIcon(spec.icon);
                    return (
                        <Button
                            key={spec.name}
                            variant="outline"
                            className="w-full justify-start p-4 h-auto hover:bg-accent/50 transition-colors"
                            onClick={() => onNodeSelect(spec.name as NodeType)}
                        >
                            <div className="flex items-center">
                                <div className="bg-muted p-2 rounded-lg me-3 border border-border">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col items-start text-start min-w-0">
                                    <span className="font-medium text-sm">
                                        {tx(spec.name, 'name', spec.display_name)}
                                    </span>
                                    <span className="text-xs text-muted-foreground whitespace-normal">
                                        {tx(spec.name, 'description', spec.description)}
                                    </span>
                                </div>
                            </div>
                        </Button>
                    );
                })}
            </div>
        </div>
    );
}

export default function AddNodePanel({ isOpen, onNodeSelect, onClose }: AddNodePanelProps) {
    const t = useTranslations('flow');
    const { specs } = useNodeSpecs();

    // Group registered specs by category, preserving the SECTION_ORDER.
    // Adding a new node type with a new spec.category just shows up here.
    const sections = useMemo(() => {
        return SECTION_ORDER.map(({ category, titleKey }) => ({
            title: t(titleKey),
            specs: specs.filter((s) => s.category === category),
        }));
    }, [specs, t]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <div
            className={`fixed z-51 right-0 top-0 h-full w-80 bg-background shadow-lg transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
        >
            <div className="p-4 h-full overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-lg font-semibold">{t('tools.addNode.title')}</h2>
                        <a
                            href="https://docs.dograh.com/voice-agent/introduction"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        >
                            <ExternalLink className="w-3 h-3" />
                            {t('tools.addNode.viewDocumentation')}
                        </a>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="space-y-6">
                    {sections.map(({ title, specs }) => (
                        <NodeSection
                            key={title}
                            title={title}
                            specs={specs}
                            onNodeSelect={onNodeSelect}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
