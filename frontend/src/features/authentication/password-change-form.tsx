import { type ComponentProps, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FormSubmitButton } from '@/components/ui/form-submit-button';
import { InputPassword } from '@/components/ui/input-password';
import { useAppForm } from '@/hooks/use-app-form';
import { api, resolveApiErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';

interface PasswordChangeFormProps {
    buttonSize?: ComponentProps<typeof Button>['size'];
    layout?: 'horizontal' | 'vertical';
    onCancel?: () => void;
    onSkip?: () => void;
    onSuccess?: () => void;
}

export function PasswordChangeForm({
    buttonSize = 'default',
    layout = 'horizontal',
    onCancel,
    onSkip,
    onSuccess,
}: PasswordChangeFormProps) {
    const { i18n, t } = useTranslation();
    const [error, setError] = useState<null | string>(null);

    // Rebuilt when the language changes so zod messages follow the locale.
    const passwordChangeSchema = useMemo(
        () =>
            z
                .object({
                    confirmPassword: z.string().min(1, {
                        message: i18n.t('auth:validation.confirmPasswordRequired'),
                    }),
                    currentPassword: z.string().min(1, {
                        message: i18n.t('auth:validation.currentPasswordRequired'),
                    }),
                    newPassword: z
                        .string()
                        .min(8, { message: i18n.t('auth:validation.passwordMinLength') })
                        // bcrypt, which hashes it server-side, refuses anything longer than 72 bytes.
                        .refine((password) => new TextEncoder().encode(password).length <= 72, {
                            message: i18n.t('auth:validation.passwordMaxLength'),
                        })
                        .refine(
                            (password) => {
                                // Count code points, not UTF-16 units, so a short
                                // string of astral characters is judged the way the
                                // endpoint judges it.
                                const length = [...password].length;

                                if (length > 15) {
                                    return true;
                                }

                                return (
                                    length >= 8 &&
                                    /[0-9]/.test(password) &&
                                    /[a-z]/.test(password) &&
                                    /[A-Z]/.test(password) &&
                                    /[!@#$&*]/.test(password)
                                );
                            },
                            {
                                message: i18n.t('auth:validation.passwordStrength'),
                            },
                        ),
                })
                .refine((data) => data.newPassword === data.confirmPassword, {
                    message: i18n.t('auth:validation.passwordsDontMatch'),
                    path: ['confirmPassword'],
                })
                .refine((data) => data.currentPassword !== data.newPassword, {
                    message: i18n.t('auth:validation.newPasswordDiffers'),
                    path: ['newPassword'],
                }),
        // i18n.language is the reactive signal — the i18n instance itself is
        // stable. Only the mutable language property belongs in the deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [i18n.language],
    );

    type PasswordChangeFormValues = z.infer<typeof passwordChangeSchema>;

    // Built per-render so the friendly copy follows the active language.
    const ERROR_BY_CODE: Record<string, string> = {
        'Users.ChangePasswordCurrentUser.InvalidCurrentPassword': t('auth:errors.currentPasswordIncorrect'),
        'Users.ChangePasswordCurrentUser.InvalidNewPassword': t('auth:errors.newPasswordInvalid'),
        'Users.ChangePasswordCurrentUser.InvalidPassword': t('auth:errors.passwordValidationFailed'),
        'Users.NotFound': t('auth:errors.userNotFound'),
    };

    const form = useAppForm<PasswordChangeFormValues>({
        defaultValues: {
            confirmPassword: '',
            currentPassword: '',
            newPassword: '',
        },
        schema: passwordChangeSchema,
    });

    const handleSubmit = async (values: PasswordChangeFormValues) => {
        setError(null);

        try {
            await api.put('/user/password', {
                confirm_password: values.confirmPassword,
                current_password: values.currentPassword,
                password: values.newPassword,
            });

            form.reset();
            toast.success(t('auth:passwordChange.success'));

            onSuccess?.();
        } catch (err: unknown) {
            setError(resolveApiErrorMessage(err, ERROR_BY_CODE, t('auth:passwordChange.failed')));
        }
    };

    const isVertical = layout === 'vertical';

    const skipButton = onSkip && (
        <Button
            className={cn('text-muted-foreground', isVertical && 'w-full')}
            onClick={onSkip}
            size={buttonSize}
            type="button"
            variant="ghost"
        >
            {t('auth:passwordChange.skipForNow')}
        </Button>
    );
    const cancelButton = onCancel && (
        <Button
            className={cn(isVertical && 'w-full')}
            onClick={onCancel}
            size={buttonSize}
            type="button"
            variant="outline"
        >
            {t('common:action.cancel')}
        </Button>
    );
    const submitButton = (
        <FormSubmitButton
            className={cn(isVertical && 'w-full')}
            size={buttonSize}
        >
            <span>{t('auth:passwordChange.submit')}</span>
        </FormSubmitButton>
    );

    return (
        <Form {...form}>
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
                            <FormLabel>{t('auth:passwordChange.currentPasswordLabel')}</FormLabel>
                            <FormControl>
                                <InputPassword
                                    {...field}
                                    placeholder={t('auth:passwordChange.currentPasswordPlaceholder')}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('auth:passwordChange.newPasswordLabel')}</FormLabel>
                            <FormControl>
                                <InputPassword
                                    {...field}
                                    placeholder={t('auth:passwordChange.newPasswordPlaceholder')}
                                />
                            </FormControl>
                            <FormDescription className="text-xs">
                                {t('auth:passwordChange.newPasswordDescription')}
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('auth:passwordChange.confirmNewPasswordLabel')}</FormLabel>
                            <FormControl>
                                <InputPassword
                                    {...field}
                                    placeholder={t('auth:passwordChange.confirmNewPasswordPlaceholder')}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {error && <div className="text-destructive text-sm">{error}</div>}

                {isVertical ? (
                    <div className="flex flex-col gap-2 pt-2">
                        {submitButton}
                        {cancelButton}
                        {skipButton}
                    </div>
                ) : (
                    <div className="flex justify-end gap-2 pt-2">
                        {skipButton}
                        {cancelButton}
                        {submitButton}
                    </div>
                )}
            </form>
        </Form>
    );
}
