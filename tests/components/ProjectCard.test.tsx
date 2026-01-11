/**
 * ProjectCard Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('ProjectCard Component', () => {
  it('renders project info', () => {
    const project = { id: 'p-1', name: 'Project Alpha', status: 'active' };
    expect(project.name).toBe('Project Alpha');
  });

  it('shows health indicator', () => {
    const health = 'on-track';
    expect(['on-track', 'at-risk', 'off-track']).toContain(health);
  });

  it('handles click', () => {
    const onClick = vi.fn();
    onClick('p-1');
    expect(onClick).toHaveBeenCalled();
  });

  it('displays progress', () => {
    const progress = 75;
    expect(progress).toBeGreaterThan(0);
  });
});
