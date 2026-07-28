/**
 * Consultify — org Brand Kit colors hook (Fala 1, 2026-07-28).
 *
 * Small, reusable fetch for `GET /api/presentations/brand-kit` — the same
 * endpoint `PresentationWizard.tsx` already calls (`loadBrandKit`). The
 * table (`brand_kits`) is keyed by `organization_id` only, not by tool, so
 * reusing this single endpoint for the Word Template Architect is correct:
 * one Brand Kit per organization, shared across every generator.
 */
import { useEffect, useState } from 'react';

import { Api } from '@/services/api';

export interface BrandKitColors {
  primary: string;
  secondary: string;
  accent: string;
}

function unwrap<T = unknown>(res: unknown): T {
  const d = (res as { data?: unknown } | null | undefined)?.data;
  if (d && typeof d === 'object' && 'data' in (d as Record<string, unknown>)) {
    return (d as { data: T }).data;
  }
  return d as T;
}

export function useBrandKitColors(): BrandKitColors | null {
  const [colors, setColors] = useState<BrandKitColors | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await Api.get('/presentations/brand-kit');
        const kit = unwrap<{ primary_color?: string; secondary_color?: string; accent_color?: string } | null>(
          res
        );
        if (cancelled || !kit || !kit.primary_color) return;
        setColors({
          primary: `#${kit.primary_color || '003A70'}`,
          secondary: `#${kit.secondary_color || '2C5F8A'}`,
          accent: `#${kit.accent_color || '00AA55'}`,
        });
      } catch {
        /* brand kit is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return colors;
}
