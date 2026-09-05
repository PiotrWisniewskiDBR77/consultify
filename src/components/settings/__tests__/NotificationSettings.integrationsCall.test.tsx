/**
 * Plan napraw MVP 05.09.2026, pozycja (5) `ustawienia-powiadomienia`: ekran
 * generował 1 błąd konsoli 501 (Not Implemented) przy każdym wejściu.
 *
 * Przyczyna: `Api.getIntegrations(orgId)` -> GET /api/integrations, który
 * Gateway.ts mountuje jako "honest 501" na środowiskach z
 * `enableStubRoutes=false` (staging), niezależnie od tego, że sam router jest
 * w pełni zaimplementowany (patrz komentarz w NotificationSettings.tsx).
 * Wywołanie usunięte jako martwe w praktyce na TYM ekranie — `integrations`
 * zawsze i tak lądowało jako `[]` przez `catch`, więc dodatkowe kolumny per
 * integrację nigdy się nie renderowały.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { NotificationSettings } from '../NotificationSettings';

vi.mock('../../../services/api', () => ({
  Api: {
    getNotificationPreferences: vi.fn().mockResolvedValue({
      taskAssignment: { email: true, inApp: true },
      taskUpdates: { email: false, inApp: true },
      milestones: { email: true, inApp: true },
      mentions: { email: true, inApp: true },
    }),
    saveNotificationPreferences: vi.fn().mockResolvedValue(undefined),
    getIntegrations: vi.fn().mockRejectedValue(new Error('should never be called')),
  },
}));

import { Api } from '../../../services/api';

const currentUser = {
  id: 'user-1',
  organizationId: 'org-1',
} as any;

describe('NotificationSettings — brak martwego wywołania Api.getIntegrations', () => {
  it('nie woła Api.getIntegrations (dawne źródło 501 w konsoli na ustawienia-powiadomienia)', async () => {
    render(<NotificationSettings currentUser={currentUser} onUpdateUser={() => {}} />);

    await waitFor(() => expect(Api.getNotificationPreferences).toHaveBeenCalledWith('user-1'));
    // Dajemy pętli zdarzeń szansę na ewentualne (błędne) wywołanie efektu,
    // które usunęliśmy — jeśli ktoś je przywróci, ten test ma się zaczerwienić.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(Api.getIntegrations).not.toHaveBeenCalled();
  });

  it('renderuje ekran preferencji bez dodatkowych kolumn integracji (zero connected integrations)', async () => {
    render(<NotificationSettings currentUser={currentUser} onUpdateUser={() => {}} />);
    expect(await screen.findByText('Notification Preferences')).toBeInTheDocument();
    // Baner "connected integration(s)" pojawia się tylko gdy integrations.length > 0.
    expect(screen.queryByText(/connected integration/i)).not.toBeInTheDocument();
  });
});
