/**
 * Mock host for <PublicBookingView> (#24c) — publiczny widget booking.
 * Reużywa REALNY komponent z wstrzykniętym `mockData` (bez backendu/DB),
 * żeby nadzorca zrobił zrzut ZANIM Piotr zobaczy (CLAUDE.md #7). Light+dark
 * przez ?theme=.
 */
import React from 'react';

import { PublicBookingView } from '../../src/views/PublicBookingView';

// Zbuduj kilka dni roboczych z realistycznymi slotami (część zajęta = mniej slotów).
function buildMockDays() {
  const days: Array<{ date: string; slots: Array<{ startAt: string; endAt: string }> }> = [];
  const base = new Date();
  let added = 0;
  for (let off = 1; off <= 10 && added < 4; off++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + off));
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    // Symuluj zajętość: pomiń godziny 11 i 14 dla pierwszego dnia.
    const busyHours = added === 0 ? [11, 14] : added === 1 ? [9, 10, 15] : [13];
    const slots = [];
    for (let h = 9; h < 17; h++) {
      if (busyHours.includes(h)) continue;
      const s = new Date(d);
      s.setUTCHours(h, 0, 0, 0);
      const e = new Date(s.getTime() + 60 * 60 * 1000);
      slots.push({ startAt: s.toISOString(), endAt: e.toISOString() });
    }
    days.push({ date: d.toISOString().slice(0, 10), slots });
    added++;
  }
  return days;
}

export function PublicBookingWidgetScreen(): React.ReactElement {
  const mockData = {
    success: true,
    consultant: { slug: 'dbr77', displayName: 'DBR77 Advisory' },
    timezone: 'Europe/Warsaw',
    slotMinutes: 60,
    days: buildMockDays(),
  };
  return <PublicBookingView slugOverride="dbr77" mockData={mockData} />;
}

export default PublicBookingWidgetScreen;
