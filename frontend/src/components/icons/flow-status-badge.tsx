import { useTranslation } from 'react-i18next';

import { FlowStatusIcon } from '@/components/icons/flow-status-icon';
import { Badge } from '@/components/ui/badge';
import { StatusType } from '@/graphql/types';

const STATUS_LABEL_KEYS: Record<StatusType, string> = {
    [StatusType.Created]: 'common:status.created',
    [StatusType.Failed]: 'common:status.failed',
    [StatusType.Finished]: 'common:status.finished',
    [StatusType.Running]: 'common:status.running',
    [StatusType.Waiting]: 'common:status.waiting',
};

export function FlowStatusBadge({ className, status }: { className?: string; status: StatusType }) {
    const { t } = useTranslation();

    return (
        <Badge
            className={className}
            variant="outline"
        >
            <FlowStatusIcon
                className="size-3"
                status={status}
            />
            {t(STATUS_LABEL_KEYS[status])}
        </Badge>
    );
}
