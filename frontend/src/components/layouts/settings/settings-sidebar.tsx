import type { ReactNode } from 'react';

import { ArrowLeft, FileText, Key, Plug, Settings as SettingsIcon, User } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';

import { VersionPanel } from '@/components/shared/version-panel';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { routes } from '@/lib/routes';
import { getSafeReturnUrl } from '@/lib/utils/auth';

interface MenuItem {
    icon?: ReactNode;
    id: string;
    path: string;
    title: string;
}

interface SettingsSidebarMenuItemProps {
    item: MenuItem;
}

const menuItems: readonly MenuItem[] = [
    {
        icon: <User className="size-4" />,
        id: 'account',
        path: routes.settings.account,
        title: 'settings:sidebar.account',
    },
    {
        icon: <Plug className="size-4" />,
        id: 'providers',
        path: routes.settings.providers,
        title: 'settings:sidebar.providers',
    },
    {
        icon: <FileText className="size-4" />,
        id: 'prompts',
        path: routes.settings.prompts,
        title: 'settings:sidebar.prompts',
    },
    {
        icon: <Key className="size-4" />,
        id: 'api-tokens',
        path: routes.settings.apiTokens,
        title: 'settings:sidebar.apiTokens',
    },
] as const;

export function SettingsSidebar() {
    const { t } = useTranslation();
    const location = useLocation();
    const [returnUrl] = useState(() =>
        getSafeReturnUrl((location.state as null | { from?: string })?.from ?? null, routes.flows),
    );

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <VersionPanel
                            icon={
                                <SettingsIcon
                                    className="size-8"
                                    strokeWidth={4 / 3}
                                />
                            }
                            title={t('common:nav.settings')}
                        />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {menuItems.map((item) => (
                                <SettingsSidebarMenuItem
                                    item={item}
                                    key={item.id}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenuButton asChild>
                    <NavLink to={returnUrl}>
                        <ArrowLeft />
                        {t('settings:sidebar.backToApp')}
                    </NavLink>
                </SidebarMenuButton>
            </SidebarFooter>
        </Sidebar>
    );
}

function SettingsSidebarMenuItem({ item }: SettingsSidebarMenuItemProps) {
    const { t } = useTranslation();
    const location = useLocation();
    const isActive = location.pathname.startsWith(item.path);

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={isActive}
            >
                <NavLink to={item.path}>
                    {item.icon}
                    {t(item.title)}
                </NavLink>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
