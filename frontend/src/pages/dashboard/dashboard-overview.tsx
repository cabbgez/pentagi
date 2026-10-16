import { useQuery } from '@apollo/client/react';
import { Activity, CircleDollarSign, Cpu, GitFork } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { UsageStatsFragmentFragment } from '@/graphql/types';

import { DashboardError, LoadingTable, MetricCard, UsageStatsRow } from '@/components/dashboard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    FlowsStatsTotalDocument,
    ToolcallsStatsByFunctionDocument,
    ToolcallsStatsTotalDocument,
    UsageStatsByAgentTypeDocument,
    UsageStatsByModelDocument,
    UsageStatsByProviderDocument,
    UsageStatsTotalDocument,
} from '@/graphql/types';
import { formatCost, formatDuration, formatNumber, formatTokenCount } from '@/lib/utils/format';

export function DashboardOverview() {
    const { t } = useTranslation();
    const {
        data: usageTotalData,
        error: usageTotalError,
        loading: usageTotalLoading,
    } = useQuery(UsageStatsTotalDocument);
    const {
        data: usageByProviderData,
        error: usageByProviderError,
        loading: usageByProviderLoading,
    } = useQuery(UsageStatsByProviderDocument);
    const {
        data: usageByModelData,
        error: usageByModelError,
        loading: usageByModelLoading,
    } = useQuery(UsageStatsByModelDocument);
    const {
        data: usageByAgentTypeData,
        error: usageByAgentTypeError,
        loading: usageByAgentTypeLoading,
    } = useQuery(UsageStatsByAgentTypeDocument);
    const {
        data: toolcallsTotalData,
        error: toolcallsTotalError,
        loading: toolcallsTotalLoading,
    } = useQuery(ToolcallsStatsTotalDocument);
    const {
        data: toolcallsByFunctionData,
        error: toolcallsByFunctionError,
        loading: toolcallsByFunctionLoading,
    } = useQuery(ToolcallsStatsByFunctionDocument);
    const {
        data: flowsTotalData,
        error: flowsTotalError,
        loading: flowsTotalLoading,
    } = useQuery(FlowsStatsTotalDocument);

    const usageTotal = usageTotalData?.usageStatsTotal;
    const toolcallsTotal = toolcallsTotalData?.toolcallsStatsTotal;
    const flowsTotal = flowsTotalData?.flowsStatsTotal;

    const totalCost = usageTotal ? usageTotal.totalUsageCostIn + usageTotal.totalUsageCostOut : 0;
    const totalTokens = usageTotal ? usageTotal.totalUsageIn + usageTotal.totalUsageOut : 0;

    const providerRows = (usageByProviderData?.usageStatsByProvider ?? []).map((item) => ({
        label: item.provider,
        stats: item.stats,
    }));
    const modelRows = (usageByModelData?.usageStatsByModel ?? []).map((item) => ({
        label: `${item.model} (${item.provider})`,
        stats: item.stats,
    }));
    const agentTypeRows = (usageByAgentTypeData?.usageStatsByAgentType ?? []).map((item) => ({
        label: item.agentType,
        stats: item.stats,
    }));

    const toolcallsByFunction = [...(toolcallsByFunctionData?.toolcallsStatsByFunction ?? [])].sort(
        (a, b) => b.totalCount - a.totalCount,
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    description={t('dashboard:totalFlowsDescription', {
                        assistants: flowsTotal?.totalAssistantsCount ?? 0,
                        subtasks: flowsTotal?.totalSubtasksCount ?? 0,
                        tasks: flowsTotal?.totalTasksCount ?? 0,
                    })}
                    error={!!flowsTotalError && !flowsTotalData}
                    icon={<GitFork className="text-muted-foreground size-4" />}
                    loading={flowsTotalLoading && !flowsTotalData}
                    title={t('dashboard:totalFlows')}
                    value={flowsTotal ? formatNumber(flowsTotal.totalFlowsCount) : '0'}
                />
                <MetricCard
                    description={t('dashboard:toolCallsDescription', {
                        duration: toolcallsTotal ? formatDuration(toolcallsTotal.totalDurationSeconds) : '—',
                    })}
                    error={!!toolcallsTotalError && !toolcallsTotalData}
                    icon={<Activity className="text-muted-foreground size-4" />}
                    loading={toolcallsTotalLoading && !toolcallsTotalData}
                    title={t('dashboard:toolCalls')}
                    value={toolcallsTotal ? formatNumber(toolcallsTotal.totalCount) : '0'}
                />
                <MetricCard
                    description={t('dashboard:totalTokensDescription')}
                    error={!!usageTotalError && !usageTotalData}
                    icon={<Cpu className="text-muted-foreground size-4" />}
                    loading={usageTotalLoading && !usageTotalData}
                    title={t('dashboard:totalTokens')}
                    value={formatTokenCount(totalTokens)}
                />
                <MetricCard
                    description={t('dashboard:totalCostDescription')}
                    error={!!usageTotalError && !usageTotalData}
                    icon={<CircleDollarSign className="text-muted-foreground size-4" />}
                    loading={usageTotalLoading && !usageTotalData}
                    title={t('dashboard:totalCost')}
                    value={formatCost(totalCost)}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('dashboard:usageByProviderTitle')}</CardTitle>
                    <CardDescription>{t('dashboard:usageByProviderDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {usageByProviderLoading && !usageByProviderData ? (
                        <LoadingTable />
                    ) : usageByProviderError && !usageByProviderData ? (
                        <ErrorTable />
                    ) : (
                        <UsageStatsTable
                            label="Usage by Provider"
                            rows={providerRows}
                        />
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('dashboard:usageByModelTitle')}</CardTitle>
                    <CardDescription>{t('dashboard:usageByModelDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {usageByModelLoading && !usageByModelData ? (
                        <LoadingTable />
                    ) : usageByModelError && !usageByModelData ? (
                        <ErrorTable />
                    ) : (
                        <UsageStatsTable
                            label="Usage by Model"
                            rows={modelRows}
                        />
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('dashboard:usageByAgentTypeTitle')}</CardTitle>
                    <CardDescription>{t('dashboard:usageByAgentTypeDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {usageByAgentTypeLoading && !usageByAgentTypeData ? (
                        <LoadingTable />
                    ) : usageByAgentTypeError && !usageByAgentTypeData ? (
                        <ErrorTable />
                    ) : (
                        <UsageStatsTable
                            label="Usage by Agent Type"
                            rows={agentTypeRows}
                        />
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('dashboard:toolCallsByFunctionTitle')}</CardTitle>
                    <CardDescription>{t('dashboard:toolCallsByFunctionDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                    {toolcallsByFunctionLoading && !toolcallsByFunctionData ? (
                        <LoadingTable />
                    ) : toolcallsByFunctionError && !toolcallsByFunctionData ? (
                        <ErrorTable />
                    ) : (
                        <Table aria-label="Tool Calls by Function">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">{t('dashboard:colFunction')}</TableHead>
                                    <TableHead className="whitespace-nowrap">{t('dashboard:colType')}</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">
                                        {t('dashboard:colCount')}
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap">
                                        {t('dashboard:colTotalDuration')}
                                    </TableHead>
                                    <TableHead className="text-right whitespace-nowrap">
                                        {t('dashboard:colAvgDuration')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {toolcallsByFunction.map((item) => (
                                    <TableRow key={item.functionName}>
                                        <TableCell className="font-medium">{item.functionName}</TableCell>
                                        <TableCell>
                                            <Badge variant={item.isAgent ? 'secondary' : 'outline'}>
                                                {item.isAgent ? t('dashboard:agent') : t('dashboard:tool')}
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
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function ErrorTable() {
    return <DashboardError className="py-8" />;
}

function UsageStatsTable({
    label,
    rows,
}: {
    label: string;
    rows: Array<{ label: string; stats: UsageStatsFragmentFragment }>;
}) {
    const { t } = useTranslation();

    return (
        <Table aria-label={label}>
            <TableHeader>
                <TableRow>
                    <TableHead className="whitespace-nowrap">{t('dashboard:colName')}</TableHead>
                    <TableHead className="text-right whitespace-nowrap">{t('dashboard:colTokensIn')}</TableHead>
                    <TableHead className="text-right whitespace-nowrap">{t('dashboard:colTokensOut')}</TableHead>
                    <TableHead className="text-right whitespace-nowrap">{t('dashboard:colCacheIn')}</TableHead>
                    <TableHead className="text-right whitespace-nowrap">{t('dashboard:colCacheOut')}</TableHead>
                    <TableHead className="text-right whitespace-nowrap">{t('dashboard:colCostIn')}</TableHead>
                    <TableHead className="text-right whitespace-nowrap">{t('dashboard:colCostOut')}</TableHead>
                    <TableHead className="text-right whitespace-nowrap">{t('dashboard:colTotalCost')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <UsageStatsRow
                        key={row.label}
                        label={row.label}
                        stats={row.stats}
                    />
                ))}
            </TableBody>
        </Table>
    );
}
