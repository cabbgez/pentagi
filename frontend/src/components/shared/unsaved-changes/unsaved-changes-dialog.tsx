import type { ReactNode } from 'react';

import { Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import i18n from '@/i18n';

export interface UnsavedChangesDialogProps {
    /** When `false`, the "Save & leave" button is disabled (e.g. form is invalid). */
    canSave: boolean;
    description?: string;
    discardText?: string;
    handleCancel: () => void;
    handleDiscard: () => void;
    handleOpenChange: (open: boolean) => void;
    handleSaveAndLeave: () => Promise<void> | void;
    isOpen: boolean;
    isSavingFromDialog: boolean;
    /** Override the default `<Save />` icon next to the save button. */
    saveIcon?: ReactNode;
    saveText?: string;
    title?: string;
}

function UnsavedChangesDialog({
    canSave,
    description = i18n.t('common:unsavedChanges.description'),
    discardText = i18n.t('common:unsavedChanges.discard'),
    handleCancel,
    handleDiscard,
    handleOpenChange,
    handleSaveAndLeave,
    isOpen,
    isSavingFromDialog,
    saveIcon = <Save />,
    saveText = i18n.t('common:unsavedChanges.save'),
    title = i18n.t('common:unsavedChanges.title'),
}: UnsavedChangesDialogProps) {
    const { t } = useTranslation();

    return (
        <Dialog
            onOpenChange={handleOpenChange}
            open={isOpen}
        >
            <DialogContent
                className="sm:max-w-md"
                onEscapeKeyDown={(event) => {
                    if (isSavingFromDialog) {
                        event.preventDefault();
                    }
                }}
                onInteractOutside={(event) => {
                    if (isSavingFromDialog) {
                        event.preventDefault();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                        disabled={isSavingFromDialog}
                        onClick={handleCancel}
                        variant="outline"
                    >
                        {t('common:action.cancel')}
                    </Button>
                    <Button
                        disabled={isSavingFromDialog}
                        onClick={handleDiscard}
                        variant="destructive"
                    >
                        {discardText}
                    </Button>
                    <Button
                        disabled={isSavingFromDialog || !canSave}
                        onClick={() => {
                            void handleSaveAndLeave();
                        }}
                        variant="default"
                    >
                        {isSavingFromDialog ? <Spinner variant="circle" /> : saveIcon}
                        {saveText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export { UnsavedChangesDialog };
