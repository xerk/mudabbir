import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AmbientNoiseConfiguration, TurnStopStrategy, WorkflowConfigurations } from "@/types/workflow-configurations";

interface ConfigurationsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workflowConfigurations: WorkflowConfigurations | null;
    workflowName: string;
    onSave: (configurations: WorkflowConfigurations, workflowName: string) => Promise<void>;
}

const DEFAULT_AMBIENT_NOISE_CONFIG: AmbientNoiseConfiguration = {
    enabled: false,
    volume: 0.3,
};

export const ConfigurationsDialog = ({
    open,
    onOpenChange,
    workflowConfigurations,
    workflowName,
    onSave
}: ConfigurationsDialogProps) => {
    const t = useTranslations("workflow");
    const [name, setName] = useState<string>(workflowName);
    const [ambientNoiseConfig, setAmbientNoiseConfig] = useState<AmbientNoiseConfiguration>(
        workflowConfigurations?.ambient_noise_configuration || DEFAULT_AMBIENT_NOISE_CONFIG
    );
    const [maxCallDuration, setMaxCallDuration] = useState<number>(
        workflowConfigurations?.max_call_duration || 600  // Default 10 minutes
    );
    const [maxUserIdleTimeout, setMaxUserIdleTimeout] = useState<number>(
        workflowConfigurations?.max_user_idle_timeout || 10  // Default 10 seconds
    );
    const [smartTurnStopSecs, setSmartTurnStopSecs] = useState<number>(
        workflowConfigurations?.smart_turn_stop_secs || 2  // Default 2 seconds
    );
    const [turnStopStrategy, setTurnStopStrategy] = useState<TurnStopStrategy>(
        workflowConfigurations?.turn_stop_strategy || 'transcription'
    );
    const [contextCompactionEnabled, setContextCompactionEnabled] = useState<boolean>(
        workflowConfigurations?.context_compaction_enabled ?? false
    );
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({
                ambient_noise_configuration: ambientNoiseConfig,
                max_call_duration: maxCallDuration,
                max_user_idle_timeout: maxUserIdleTimeout,
                smart_turn_stop_secs: smartTurnStopSecs,
                turn_stop_strategy: turnStopStrategy,
                context_compaction_enabled: contextCompactionEnabled,
            }, name);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save configurations:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Sync state with props when dialog opens
    useEffect(() => {
        if (open) {
            setName(workflowName);
            setAmbientNoiseConfig(workflowConfigurations?.ambient_noise_configuration || DEFAULT_AMBIENT_NOISE_CONFIG);
            setMaxCallDuration(workflowConfigurations?.max_call_duration || 600);
            setMaxUserIdleTimeout(workflowConfigurations?.max_user_idle_timeout || 10);
            setSmartTurnStopSecs(workflowConfigurations?.smart_turn_stop_secs || 2);
            setTurnStopStrategy(workflowConfigurations?.turn_stop_strategy || 'transcription');
            setContextCompactionEnabled(workflowConfigurations?.context_compaction_enabled ?? false);
        }
    }, [open, workflowName, workflowConfigurations]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t("configurations.title")}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Workflow Name Section */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold mb-1">{t("configurations.agentName.title")}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t("configurations.agentName.description")}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="workflow_name" className="text-xs">
                                {t("configurations.agentName.nameLabel")}
                            </Label>
                            <Input
                                id="workflow_name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t("configurations.agentName.namePlaceholder")}
                            />
                        </div>
                    </div>

                    {/* Ambient Noise Section */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold mb-1">{t("configurations.ambientNoise.title")}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t("configurations.ambientNoise.description")}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="ambient-noise-enabled" className="text-sm">
                                    {t("configurations.ambientNoise.useLabel")}
                                </Label>
                                <Switch
                                    id="ambient-noise-enabled"
                                    checked={ambientNoiseConfig.enabled}
                                    onCheckedChange={(checked) =>
                                        setAmbientNoiseConfig(prev => ({ ...prev, enabled: checked }))
                                    }
                                />
                            </div>

                            {ambientNoiseConfig.enabled && (
                                <div className="space-y-2">
                                    <Label htmlFor="ambient-volume" className="text-xs">
                                        {t("configurations.ambientNoise.volumeLabel")}
                                    </Label>
                                    <Input
                                        id="ambient-volume"
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="1"
                                        value={ambientNoiseConfig.volume}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value);
                                            if (!isNaN(value)) {
                                                setAmbientNoiseConfig(prev => ({ ...prev, volume: value }));
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Turn Detection Section */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold mb-1">{t("configurations.turnDetection.title")}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t("configurations.turnDetection.description")}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="turn_stop_strategy" className="text-xs">
                                {t("configurations.turnDetection.strategyLabel")}
                            </Label>
                            <Select
                                value={turnStopStrategy}
                                onValueChange={(value: TurnStopStrategy) => setTurnStopStrategy(value)}
                            >
                                <SelectTrigger id="turn_stop_strategy">
                                    <SelectValue placeholder={t("configurations.turnDetection.strategyPlaceholder")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="transcription">
                                        {t("configurations.turnDetection.strategyTranscription")}
                                    </SelectItem>
                                    <SelectItem value="turn_analyzer">
                                        {t("configurations.turnDetection.strategyTurnAnalyzer")}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {turnStopStrategy === 'transcription'
                                    ? t("configurations.turnDetection.transcriptionHelp")
                                    : t("configurations.turnDetection.turnAnalyzerHelp")}
                            </p>
                        </div>

                        {turnStopStrategy === 'turn_analyzer' && (
                            <div className="space-y-2">
                                <Label htmlFor="smart_turn_stop_secs" className="text-xs">
                                    {t("configurations.turnDetection.incompleteTimeoutLabel")}
                                </Label>
                                <Input
                                    id="smart_turn_stop_secs"
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    max="10"
                                    value={smartTurnStopSecs}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value);
                                        if (!isNaN(value) && value >= 0.5) {
                                            setSmartTurnStopSecs(value);
                                        }
                                    }}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t("configurations.turnDetection.incompleteTimeoutHelp")}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Context Management Section */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold mb-1">{t("configurations.contextCompaction.title")}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t("configurations.contextCompaction.description")}
                            </p>
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="context-compaction-enabled" className="text-sm">
                                {t("configurations.contextCompaction.enableLabel")}
                            </Label>
                            <Switch
                                id="context-compaction-enabled"
                                checked={contextCompactionEnabled}
                                onCheckedChange={setContextCompactionEnabled}
                            />
                        </div>
                    </div>

                    {/* Call Management Section */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold mb-1">{t("configurations.callManagement.title")}</h3>
                            <p className="text-xs text-muted-foreground">
                                {t("configurations.callManagement.description")}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="max_call_duration" className="text-xs">
                                    {t("configurations.callManagement.maxCallDurationLabel")}
                                </Label>
                                <Input
                                    id="max_call_duration"
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={maxCallDuration}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        if (!isNaN(value) && value > 0) {
                                            setMaxCallDuration(value);
                                        }
                                    }}
                                />
                                <p className="text-xs text-muted-foreground">{t("configurations.callManagement.maxCallDurationHelp")}</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="max_user_idle_timeout" className="text-xs">
                                    {t("configurations.callManagement.maxUserIdleTimeoutLabel")}
                                </Label>
                                <Input
                                    id="max_user_idle_timeout"
                                    type="number"
                                    step="1"
                                    min="1"
                                    value={maxUserIdleTimeout}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        if (!isNaN(value) && value > 0) {
                                            setMaxUserIdleTimeout(value);
                                        }
                                    }}
                                />
                                <p className="text-xs text-muted-foreground">{t("configurations.callManagement.maxUserIdleTimeoutHelp")}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t("configurations.cancel")}
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? t("configurations.saving") : t("configurations.save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

