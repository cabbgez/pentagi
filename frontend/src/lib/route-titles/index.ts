import type { ComponentType } from 'react';

import {
    FlowDocument,
    FlowTemplateDocument,
    KnowledgeDocumentDocument,
    SettingsProvidersDocument,
} from '@/graphql/types';
import i18n from '@/i18n';

import { apolloTitle } from './apollo-title';
import { formatPromptId } from './format-prompt-id';
import { type RouteParams } from './render-title';

export interface RouteTitleHandle {
    title: TitleResolver;
}

/**
 * A `handle.title` value can be one of three forms:
 *   - `string` — fully static, known at build time.
 *   - `(params) => string` — derived synchronously from URL params.
 *   - `ComponentType<{ params }>` — reactive (e.g. subscribes to Apollo
 *     cache for resource-driven titles). Must be produced by `apolloTitle()`
 *     so the marker it attaches lets `DocumentTitle` distinguish a component
 *     from a `(params) => string` resolver at runtime. A hand-rolled component
 *     function will be misdetected as a resolver and called with raw params —
 *     always route reactive titles through `apolloTitle()`.
 */
export type TitleResolver = ((params: RouteParams) => string) | ComponentType<{ params: RouteParams }> | string;

// Localized titles resolve through i18next so the document <title> reacts to
// language changes. i18n.t is called at render time (inside the resolver) —
// NOT at module load — so switching language updates the current tab's title.
const t = (key: string): string => i18n.t(key);

/**
 * Single source of truth for every route's document `<title>`. `app.tsx`
 * imports nothing from Apollo for title purposes — it only spreads handles
 * from this registry onto the matching <Route>.
 */
export const routeTitles = {
    account: { title: (): string => t('common:titles.account') },
    apiTokens: { title: (): string => t('common:titles.apiTokens') },
    dashboard: { title: (): string => t('common:titles.dashboard') },
    flow: {
        title: apolloTitle({
            document: FlowDocument,
            select: (data, { flowId }) =>
                data?.flow?.title && flowId
                    ? `${t('common:titles.flow')} #${flowId} — ${data.flow.title}`
                    : t('common:titles.flow'),
            variables: ({ flowId }) => (flowId ? { id: flowId } : null),
        }),
    },
    flowReport: { title: (): string => t('common:titles.flowReport') },
    flows: { title: (): string => t('common:titles.flows') },
    knowledge: {
        title: apolloTitle({
            document: KnowledgeDocumentDocument,
            select: (data, { knowledgeId }) =>
                knowledgeId === 'new'
                    ? t('common:titles.newKnowledge')
                    : data?.knowledgeDocument?.question || t('common:titles.knowledge'),
            variables: ({ knowledgeId }) => (!knowledgeId || knowledgeId === 'new' ? null : { id: knowledgeId }),
        }),
    },
    knowledges: { title: (): string => t('common:titles.knowledges') },
    login: { title: (): string => t('common:titles.login') },
    newFlow: { title: (): string => t('common:titles.newFlow') },
    oauth: { title: (): string => t('common:titles.oauth') },
    prompt: {
        title: (params: RouteParams) => (params.promptId ? formatPromptId(params.promptId) : t('common:titles.prompt')),
    },
    prompts: { title: (): string => t('common:titles.prompts') },

    provider: {
        title: apolloTitle({
            document: SettingsProvidersDocument,
            select: (data, { providerId }) => {
                if (providerId === 'new') {
                    return t('common:titles.newProvider');
                }

                const provider = data?.settingsProviders.userDefined?.find(
                    (candidate) => String(candidate.id) === providerId,
                );

                return provider?.name || t('common:titles.provider');
            },
            variables: ({ providerId }) => (providerId === 'new' ? null : {}),
        }),
    },

    providers: { title: (): string => t('common:titles.providers') },

    resources: { title: (): string => t('common:titles.resources') },

    template: {
        title: apolloTitle({
            document: FlowTemplateDocument,
            select: (data, { templateId }) =>
                templateId === 'new'
                    ? t('common:titles.newTemplate')
                    : data?.flowTemplate?.title || t('common:titles.template'),
            variables: ({ templateId }) => (!templateId || templateId === 'new' ? null : { templateId }),
        }),
    },

    templates: { title: (): string => t('common:titles.templates') },
} as const satisfies Record<string, RouteTitleHandle>;
