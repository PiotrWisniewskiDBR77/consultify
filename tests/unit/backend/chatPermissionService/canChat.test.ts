import { describe, expect, it } from 'vitest';

import { canChat } from '../../../../server/src/services/chatPermissionService.ts';

describe('chatPermissionService: canChat', () => {
  it('denies everything for role=none with reason', () => {
    const read = canChat('read', 'none');
    expect(read.allowed).toBe(false);
    expect(read.reason).toContain('not a member');

    const create = canChat('create_project', 'none');
    expect(create.allowed).toBe(false);
    expect(create.reason).toBeTruthy();
  });

  it('allows everything for role=owner', () => {
    expect(canChat('read', 'owner').allowed).toBe(true);
    expect(canChat('delete_project', 'owner').allowed).toBe(true);
    expect(canChat('create_share_link', 'owner').allowed).toBe(true);
    expect(canChat('read', 'owner').reason).toBe('');
  });

  it('allows contributor for read + non-destructive actions', () => {
    expect(canChat('read', 'contributor').allowed).toBe(true);
    expect(canChat('create_project', 'contributor').allowed).toBe(true);
    expect(canChat('create_thread', 'contributor').allowed).toBe(true);
    expect(canChat('add_message', 'contributor').allowed).toBe(true);
  });

  it('allows contributor destructive actions only when isCreator=true', () => {
    expect(canChat('edit_project', 'contributor', { isCreator: false }).allowed).toBe(false);
    expect(canChat('delete_project', 'contributor', { isCreator: false }).allowed).toBe(false);
    expect(canChat('manage_thread', 'contributor', { isCreator: false }).allowed).toBe(false);

    expect(canChat('edit_project', 'contributor', { isCreator: true }).allowed).toBe(true);
    expect(canChat('delete_project', 'contributor', { isCreator: true }).allowed).toBe(true);
    expect(canChat('manage_thread', 'contributor', { isCreator: true }).allowed).toBe(true);
  });

  it('contributor denied actions include actionable reason', () => {
    const edit = canChat('edit_project', 'contributor', { isCreator: false });
    expect(edit.reason).toContain('folder creator');

    const manage = canChat('manage_thread', 'contributor', { isCreator: false });
    expect(manage.reason).toContain('conversation creator');

    const share = canChat('create_share_link', 'contributor');
    expect(share.reason).toContain('admin');
  });

  it('allows viewer only for read', () => {
    expect(canChat('read', 'viewer').allowed).toBe(true);
    expect(canChat('add_message', 'viewer').allowed).toBe(false);
    expect(canChat('create_project', 'viewer').allowed).toBe(false);
  });

  it('viewer denied actions include role-specific guidance', () => {
    const msg = canChat('add_message', 'viewer');
    expect(msg.reason).toContain('Viewers');
    expect(msg.reason).toContain('send messages');
  });
});
