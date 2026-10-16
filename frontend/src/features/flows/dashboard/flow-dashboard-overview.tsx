import { useQuery } from '@apollo/client/react';
import { Activity, CircleDollarSign, Cpu, GitFork } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { MetricCard, UsageStatsRow } from '@/components/dashboard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import FlowAgentIcon from '@/features/flows/agents/flow-agent-icon';
import {
    AgentType,
    FlowStatsByFlowDocument,
    ToolcallsStatsByFlowDocument,
    ToolcallsStatsByFunctionForFlowDocument,
    UsageStatsByAgentTypeForFlowDocument,
    UsageStatsByFlowDocument,
    UsageStatsByModelAgentsForFlowDocument,
} from '@/graphql/types';
import { formatCost, formatDuration, formatNumber, formatTokenCount } from '@/lib/utils/format';

// AgentType enum values are snake_case ('primary_agent', 'tool_call_fixer');
// the enums:agentType locale keys are camelCase ('primaryAgent'). Camelize to
// look up a translated label, falling back to the raw value for types without
// a locale entry.
const camelizeAgentType = (value: string): string =>
    value.replaceAll(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

export function FlowDashboardOverview({ flowId }: { flowId: string }) {
    const { t } = useTranslation();

    const {
        data: usageData,
        error: usageError,
        loading: usageLoading,
    } = useQuery(UsageStatsByFlowDocument, {
        variables: { flowId },
    });
    const { data: usageByAgentData } = useQuery(UsageStatsByAgentTypeForFlowDocument, {
        variables: { flowId },
    });
    const { data: usageByModelAgentsData } = useQuery(UsageStatsByModelAgentsForFlowDocument, {
        variables: { flowId },
    });
    const {
        data: toolcallsData,
        error: toolcallsError,
        loading: toolcallsLoading,
    } = useQuery(ToolcallsStatsByFlowDocument, {
        variables: { flowId },
    });
    const { data: toolcallsByFunctionData } = useQuery(ToolcallsStatsByFunctionForFlowDocument, {
        variables: { flowId },
    });
    const {
        data: flowStatsData,
        error: flowStatsError,
        loading: flowStatsLoading,
    } = useQuery(FlowStatsByFlowDocument, {
        variables: { flowId },
    });

    const usage = usageData?.usageStatsByFlow;
    const toolcalls = toolcallsData?.toolcallsStatsByFlow;
    const flowStats = flowStatsData?.flowStatsByFlow;

    const totalCost = usage ? usage.totalUsageCostIn + usage.totalUsageCostOut : 0;
    const totalTokens = usage ? usage.totalUsageIn + usage.totalUsageOut : 0;

    const agentTypeRows = useMemo(() => {
        const seen = new Set<string>();

        return (usageByAgentData?.usageStatsByAgentTypeForFlow ?? [])
            .filter((item) => {
                if (seen.has(item.agentType)) {
                    return false;
                }

                seen.add(item.agentType);

                return true;
            })
            .map((item) => ({
                label: t(`enums:agentType.${camelizeAgentType(item.agentType)}`, { defaultValue: item.agentType }),
                stats: item.stats,
            }));
    }, [t, usageByAgentData]);

    const modelAgentRows = useMemo(() => {
        const seen = new Set<string>();

        return (usageByModelAgentsData?.usageStatsByModelAgentsForFlow ?? []).filter((item) => {
            const key = `${item.model}|${item.provider}`;

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);

            return true;
        });
    }, [usageByModelAgentsData]);

    const toolcallsByFunction = useMemo(() => {
        const seen = new Set<string>();

        return [...(toolcallsByFunctionData?.toolcallsStatsByFunctionForFlow ?? [])]
            .filter((item) => {
                if (seen.has(item.functionName)) {
                    return false;
                }

                seen.add(item.functionName);

                return true;
            })
            .sort((a, b) => b.totalCount - a.totalCount);
    }, [toolcallsByFunctionData]);

    const anyLoading =
        (usageLoading && !usageData) || (toolcallsLoading && !toolcallsData) || (flowStatsLoading && !flowStatsData);

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <MetricCard
                    description={t('flows:dashboard.tasksDescription', {
                        assistants: flowStats?.totalAssistantsCount ?? 0,
                        subtasks: flowStats?.totalSubtasksCount ?? 0,
                    })}
                    error={!!flowStatsError && !flowStatsData}
                    icon={<GitFork className="text-muted-foreground size-4" />}
                    loading={anyLoading}
                    title={t('flows:dashboard.tasks')}
                    value={flowStats ? formatNumber(flowStats.totalTasksCount) : '0'}
                />
                <MetricCard
                    description={t('flows:dashboard.toolCallsDescription', {
                        duration: toolcalls ? formatDuration(toolcalls.totalDurationSeconds) : '—',
                    })}
                    error={!!toolcallsError && !toolcallsData}
                    icon={<Activity className="text-muted-foreground size-4" />}
                    loading={anyLoading}
                    title={t('flows:dashboard.toolCalls')}
                    value={toolcalls ? formatNumber(toolcalls.totalCount) : '0'}
                />
                <MetricCard
                    description={t('flows:dashboard.tokensDescription')}
                    error={!!usageError && !usageData}
                    icon={<Cpu className="text-muted-foreground size-4" />}
                    loading={anyLoading}
                    title={t('flows:dashboard.tokens')}
                    value={formatTokenCount(totalTokens)}
                />
                <MetricCard
                    description={t('flows:dashboard.costDescription')}
                    error={!!usageError && !usageData}
                    icon={<CircleDollarSign className="text-muted-foreground size-4" />}
                    loading={anyLoading}
                    title={t('flows:dashboard.cost')}
                    value={formatCost(totalCost)}
                />
            </div>

            {!!modelAgentRows.length && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t('flows:dashboard.usageByModelProvider')}</CardTitle>
                        <CardDescription>{t('flows:dashboard.usageByModelProviderDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table aria-label="Usage by Model & Provider">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-40 whitespace-nowrap">
                                        {t('flows:dashboard.colModel')}
                                    </TableHead>
                                    <TableHead className="whitespace-nowrap">
                                        {t('flows:dashboard.colProvider')}
                                    </TableHead>
                                    <TableHead className="w-36 whitespace-nowrap">
                                        {t('flows:dashboard.colAgents')}
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap">
                                        {t('flows:dashboard.colTokensIn')}
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap">
                                        {t('flows:dashboard.colTokensOut')}
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap">
                                        {t('flows:dashboard.colCacheIn')}
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap">
                                        {t('flows:dashboard.colCacheOut')}
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap">
                                        {t('flows:dashboard.colCostIn')}
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap">
                                        {t('flows:dashboard.colCostOut')}
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap">
                                        {t('flows:dashboard.colTotalCost')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {modelAgentRows.map((row) => (
                                    <TableRow key={`${row.model}|${row.provider}`}>
                                        <TableCell className="font-medium">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="block w-40 truncate">{row.model}</span>
                                                </TooltipTrigger>
                                                <TooltipContent>{row.model}</TooltipContent>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>{row.provider}</TableCell>
                                        <TableCell>
                                            <div className="flex w-36 flex-wrap gap-1">
                                                {row.agentTypes.map((agentType) => (
                                                    <FlowAgentIcon
                                                        className="size-3.5"
                                                        key={agentType}
                                                        tooltip={t(`enums:agentType.${camelizeAgentType(agentType)}`, {
                                                            defaultValue: agentType,
                                                        })}
                                                        type={agentType as AgentType}
                                                    />
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatTokenCount(row.stats.totalUsageIn)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatTokenCount(row.stats.totalUsageOut)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatTokenCount(row.stats.totalUsageCacheIn)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatTokenCount(row.stats.totalUsageCacheOut)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatCost(row.stats.totalUsageCostIn)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatCost(row.stats.totalUsageCostOut)}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            {formatCost(row.stats.totalUsageCostIn + row.stats.totalUsageCostOut)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {!!agentTypeRows.length && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t('flows:dashboard.usageByAgentType')}</CardTitle>
                        <CardDescription>{t('flows:dashboard.usageByAgentTypeDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table aria-label="Usage by Agent Type">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('flows:dashboard.colAgentType')}</TableHead>
                                    <TableHead className="text-right">{t('flows:dashboard.colTokensIn')}</TableHead>
                                    <TableHead className="text-right">{t('flows:dashboard.colTokensOut')}</TableHead>
                                    <TableHead className="text-right">{t('flows:dashboard.colCacheIn')}</TableHead>
                                    <TableHead className="text-right">{t('flows:dashboard.colCacheOut')}</TableHead>
                                    <TableHead className="text-right">{t('flows:dashboard.colCostIn')}</TableHead>
                                    <TableHead className="text-right">{t('flows:dashboard.colCostOut')}</TableHead>
                                    <TableHead className="text-right">{t('flows:dashboard.colTotalCost')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agentTypeRows.map((row) => (
                                    <UsageStatsRow
                                        key={row.label}
                                        label={row.label}
                                        stats={row.stats}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {!!toolcallsByFunction.length && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t('flows:dashboard.toolCallsByFunction')}</CardTitle>
                        <CardDescription>{t('flows:dashboard.toolCallsByFunctionDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table aria-label="Tool Calls by Function">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('flows:dashboard.colFunction')}</TableHead>
                                    <TableHead>{t('flows:dashboard.colType')}</TableHead>
                                    <TableHead className="text-right">{t('flows:dashboard.colCount')}</TableHead>
                                    <TableHead className="text-right">
                                        {t('flows:dashboard.colTotalDuration')}
                                    </TableHead>
                                    <TableHead className="text-right">{t('flows:dashboard.colAvgDuration')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {toolcallsByFunction.map((item) => (
                                    <TableRow key={item.functionName}>
                                        <TableCell className="font-medium">{item.functionName}</TableCell>
                                        <TableCell>
                                            <Badge variant={item.isAgent ? 'secondary' : 'outline'}>
                                                {item.isAgent ? t('flows:dashboard.agent') : t('flows:dashboard.tool')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{formatNumber(item.totalCount)}</TableCell>
                                        <TableCell className="text-right">
                                            {formatDuration(item.totalDurationSeconds)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatDuration(item.avgDurationSeconds)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
