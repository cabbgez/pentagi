import { describe, expect, it } from 'vitest';

import type { UserResourceFragmentFragment } from '@/graphql/types';

import { buildPathsQuery, toFileNode } from './resources-utils';
import { resourcesCopyFormSchema } from './use-resources-copy';
import { resourcesMkdirFormSchema } from './use-resources-mkdir';
import { resourcesMoveFormSchema } from './use-resources-move';

describe('buildPathsQuery', () => {
    it('serialises multiple paths into repeated paths[] params', () => {
        expect(buildPathsQuery(['a.txt', 'reports/2025/b.txt'])).toBe(
            'paths%5B%5D=a.txt&paths%5B%5D=reports%2F2025%2Fb.txt',
        );
    });

    it('returns an empty query string for an empty list', () => {
        expect(buildPathsQuery([])).toBe('');
    });
});

describe('toFileNode', () => {
    it('maps a REST/GraphQL resource fragment onto the FileNode shape', () => {
        const fragment: UserResourceFragmentFragment = {
            createdAt: '2026-08-04T00:00:00Z',
            id: '42',
            isDir: false,
            name: 'scan.txt',
            path: 'reports/scan.txt',
            size: 128,
            updatedAt: '2026-08-04T00:00:00Z',
            userId: '7',
        };

        expect(toFileNode(fragment)).toEqual({
            id: '42',
            isDir: false,
            modifiedAt: '2026-08-04T00:00:00Z',
            name: 'scan.txt',
            path: 'reports/scan.txt',
            size: 128,
        });
    });
});

describe('resourcesMkdirFormSchema', () => {
    it('rejects an empty path', () => {
        const result = resourcesMkdirFormSchema.safeParse({ path: '   ' });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('Path cannot be empty');
        }
    });

    it('rejects an absolute path', () => {
        const result = resourcesMkdirFormSchema.safeParse({ path: '/reports/2025' });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('Path must be relative (no leading "/")');
        }
    });

    it('rejects ".." segments', () => {
        const result = resourcesMkdirFormSchema.safeParse({ path: 'a/../b' });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('Path must not contain ".."');
        }
    });
});

describe('resourcesMoveFormSchema', () => {
    it('rejects an empty destination', () => {
        const result = resourcesMoveFormSchema.safeParse({ destination: '' });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('Destination cannot be empty');
        }
    });

    it('rejects an absolute destination', () => {
        const result = resourcesMoveFormSchema.safeParse({ destination: '/reports' });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('Destination must be a relative path');
        }
    });

    it('rejects ".." segments', () => {
        const result = resourcesMoveFormSchema.safeParse({ destination: 'a/../b' });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('Destination must not contain ".."');
        }
    });
});

describe('resourcesCopyFormSchema', () => {
    it('rejects an empty destination', () => {
        const result = resourcesCopyFormSchema.safeParse({ destination: '' });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('Destination cannot be empty');
        }
    });

    it('rejects an absolute destination', () => {
        const result = resourcesCopyFormSchema.safeParse({ destination: '/reports' });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('Destination must be a relative path');
        }
    });

    it('rejects ".." segments', () => {
        const result = resourcesCopyFormSchema.safeParse({ destination: 'a/../b' });

        expect(result.success).toBe(false);

        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe('Destination must not contain ".."');
        }
    });
});
