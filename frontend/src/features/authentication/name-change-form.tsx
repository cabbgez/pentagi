import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/hooks/use-app-form';
import { api, resolveApiErrorMessage } from '@/lib/axios';
import { useUser } from '@/providers/user-provider';

interface NameChangeFormProps {
    onCancel?: () => void;
    onSuccess?: () => void;
}

export function NameChangeForm({ onCancel, onSuccess }: NameChangeFormProps) {
    const { i18n, t } = useTranslation();
    const [error, setError] = useState<null | string>(null);
    const { authInfo, patchUser, refreshAuthInfo } = useUser();

    // Schema is rebuilt whenever the language changes so zod validation
    // messages follow the active locale. zod v4's `message` is a plain
    // string, so the schema itself must be reconstructed — a message
    // function (v3 style) is not supported.
    const nameChangeSchema = useMemo(
        () =>
            z.object({
                name: z
                    .string()
                    .trim()
                    .min(1, { message: i18n.t('auth:validation.nameRequired') })
                    .max(70, { message: i18n.t('auth:validation.nameMaxLength') }),
            }),
        // i18n.language is the reactive signal — the i18n instance itself is
        // stable. Only the mutable language property belongs in the deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [i18n.language],
    );

    type NameChangeFormValues = z.infer<typeof nameChangeSchema>;

    // Built per-render so the friendly copy follows the active language.
    const ERROR_BY_CODE: Record<string, string> = {
        'Users.ChangeNameCurrentUser.InvalidName': t('auth:errors.nameInvalid'),
        'Users.NotFound': t('auth:errors.userNotFound'),
    };

    const form = useAppForm<NameChangeFormValues>({
        defaultValues: {
            name: authInfo?.user?.name ?? '',
        },
        schema: nameChangeSchema,
    });

    const handleSubmit = async (values: NameChangeFormValues) => {
        setError(null);

        try {
            await api.put('/user/name', { name: values.name });

            toast.success(t('auth:nameChange.success'));

            patchUser({ name: values.name });
            await refreshAuthInfo();

            onSuccess?.();
        } catch (err: unknown) {
            setError(resolveApiErrorMessage(err, ERROR_BY_CODE, t('auth:nameChange.failed')));
        }
    };

    return (
        <Form {...form}>
            <form
                className="flex flex-col gap-4"
                noValidate
                onSubmit={form.handleSubmit(handleSubmit)}
            >
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('auth:nameChange.displayNameLabel')}</FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    placeholder={t('auth:nameChange.displayNamePlaceholder')}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {error && <div className="text-destructive text-sm">{error}</div>}

                <div className="flex justify-end gap-2 pt-2">
                    {onCancel && (
                        <Button
                            onClick={onCancel}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {t('common:action.cancel')}
                        </Button>
                    )}
                    <FormSubmitButton size="sm">
                        <span>{t('auth:nameChange.submit')}</span>
                    </FormSubmitButton>
                </div>
            </form>
        </Form>
    );
}
