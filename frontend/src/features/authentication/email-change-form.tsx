import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { Input } from '@/components/ui/input';
import { InputPassword } from '@/components/ui/input-password';
import { useAppForm } from '@/hooks/use-app-form';
import { api, resolveApiErrorMessage } from '@/lib/axios';
import { useUser } from '@/providers/user-provider';

interface EmailChangeFormProps {
    onCancel?: () => void;
    onSuccess?: () => void;
}

export function EmailChangeForm({ onCancel, onSuccess }: EmailChangeFormProps) {
    const { i18n, t } = useTranslation();
    const [error, setError] = useState<null | string>(null);
    const { patchUser, refreshAuthInfo } = useUser();

    // Rebuilt when the language changes so zod messages follow the locale.
    const emailChangeSchema = useMemo(
        () =>
            z.object({
                currentPassword: z.string().min(1, {
                    message: i18n.t('auth:validation.currentPasswordRequired'),
                }),
                newEmail: z
                    .string()
                    .trim()
                    .toLowerCase()
                    .min(1, { message: i18n.t('auth:validation.emailRequired') })
                    .email({ message: i18n.t('auth:validation.invalidEmail') })
                    .max(50, { message: i18n.t('auth:validation.emailMaxLength') }),
            }),
        // i18n.language is the reactive signal — the i18n instance itself is
        // stable. Only the mutable language property belongs in the deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [i18n.language],
    );

    type EmailChangeFormValues = z.infer<typeof emailChangeSchema>;

    // Built per-render so the friendly copy follows the active language.
    const ERROR_BY_CODE: Record<string, string> = {
        'Users.ChangeEmailCurrentUser.EmailAlreadyExists': t('auth:errors.emailAlreadyExists'),
        'Users.ChangeEmailCurrentUser.InvalidCurrentPassword': t('auth:errors.currentPasswordIncorrect'),
        'Users.ChangeEmailCurrentUser.InvalidEmail': t('auth:errors.newEmailInvalid'),
        'Users.NotFound': t('auth:errors.userNotFound'),
    };

    const form = useAppForm<EmailChangeFormValues>({
        defaultValues: {
            currentPassword: '',
            newEmail: '',
        },
        schema: emailChangeSchema,
    });

    const handleSubmit = async (values: EmailChangeFormValues) => {
        setError(null);

        try {
            await api.put('/user/email', {
                current_password: values.currentPassword,
                mail: values.newEmail,
            });

            form.reset();
            toast.success(t('auth:emailChange.success'));

            patchUser({ mail: values.newEmail });
            await refreshAuthInfo();

            onSuccess?.();
        } catch (err: unknown) {
            setError(resolveApiErrorMessage(err, ERROR_BY_CODE, t('auth:emailChange.failed')));
        }
    };

    return (
        <Form {...form}>
            {/* noValidate: the type="email" field would otherwise fire the browser's native (locale-styled)
                validation popup on submit, pre-empting our zod message. Validation runs through zod instead. */}
            <form
                className="flex flex-col gap-4"
                noValidate
                onSubmit={form.handleSubmit(handleSubmit)}
            >
                <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('auth:emailChange.currentPasswordLabel')}</FormLabel>
                            <FormControl>
                                <InputPassword
                                    {...field}
                                    placeholder={t('auth:emailChange.currentPasswordPlaceholder')}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="newEmail"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('auth:emailChange.newEmailLabel')}</FormLabel>
                            <FormControl>
                                <Input
                                    {...field}
                                    placeholder={t('auth:emailChange.newEmailPlaceholder')}
                                    type="email"
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
                        <span>{t('auth:emailChange.submit')}</span>
                    </FormSubmitButton>
                </div>
            </form>
        </Form>
    );
}
