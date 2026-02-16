import { describe, expect, it } from 'vitest';

import { canChat } from '../../../../server/src/services/chatPermissionService.ts';

describe('chatPermissionService: canChat', () => {
  it('denies everything for role=none', () => {
    expect(canChat('read', 'none')).toBe(false);
    expect(canChat('create_project', 'none')).toBe(false);
  });

  it('allows everything for role=owner', () => {
    expect(canChat('read', 'owner')).toBe(true);
    expect(canChat('delete_project', 'owner')).toBe(true);
    expect(canChat('create_share_link', 'owner')).toBe(true);
  });

  it('allows contributor for read + non-destructive actions', () => {
    expect(canChat('read', 'contributor')).toBe(true);
    expect(canChat('create_project', 'contributor')).toBe(true);
    expect(canChat('create_thread', 'contributor')).toBe(true);
    expect(canChat('add_message', 'contributor')).toBe(true);
  });

  it('allows contributor destructive actions only when isCreator=true', () => {
    expect(canChat('edit_project', 'contributor', { isCreator: false })).toBe(false);
    expect(canChat('delete_project', 'contributor', { isCreator: false })).toBe(false);
    expect(canChat('manage_thread', 'contributor', { isCreator: false })).toBe(false);

    expect(canChat('edit_project', 'contributor', { isCreator: true })).toBe(true);
    expect(canChat('delete_project', 'contributor', { isCreator: true })).toBe(true);
    expect(canChat('manage_thread', 'contributor', { isCreator: true })).toBe(true);
  });

  it('allows viewer only for read', () => {
    expect(canChat('read', 'viewer')).toBe(true);
    expect(canChat('add_message', 'viewer')).toBe(false);
    expect(canChat('create_project', 'viewer')).toBe(false);
  });
});
