import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import i18n from '@/i18n';
import { api, getApiErrorMessage } from '@/lib/axios';

import { RESOURCES_MKDIR_API_PATH } from './resources-constants';

export const resourcesMkdirFormSchema = z.object({
    path: z
        .string()
        .trim()
        .min(1, { message: i18n.t('resources:validation.pathRequired') })
        .refine((value) => !value.startsWith('/'), { message: i18n.t('resources:validation.pathRelative') })
        .refine((value) => !value.split('/').includes('..'), { message: i18n.t('resources:validation.pathNoDotDot') }),
});

export type ResourcesMkdirFormValues = z.infer<typeof resourcesMkdirFormSchema>;

interface MkdirRequestBody {
    path: string;
}

interface UseResourcesMkdirResult {
    isCreating: boolean;
    mkdir: (values: ResourcesMkdirFormValues) => Promise<boolean>;
}

/** Wraps `POST /resources/mkdir` (idempotent — returns existing dir on hit). */
export function useResourcesMkdir(): UseResourcesMkdirResult {
    const [isCreating, setIsCreating] = useState(false);

    const mkdir = useCallback(async ({ path }: ResourcesMkdirFormValues): Promise<boolean> => {
        setIsCreating(true);

        try {
            await api.post<void, MkdirRequestBody>(RESOURCES_MKDIR_API_PATH, { path: path.trim() });

            toast.success(i18n.t('resources:directoryCreated'), {
                description: i18n.t('resources:createdAt', { path: `/${path.trim()}` }),
            });

            return true;
        } catch (error) {
            const description = getApiErrorMessage(error, i18n.t('resources:createDirectoryError'));

            toast.error(i18n.t('resources:createDirectoryFailed'), { description });

            return false;
        } finally {
            setIsCreating(false);
        }
    }, []);

    return {
        isCreating,
        mkdir,
    };
}
