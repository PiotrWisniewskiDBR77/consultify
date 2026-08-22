import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/components/navigation/Sidebar/menuConfig.ts'),
  'utf8'
);

const moduleBlock = (id: string) => {
  const start = source.indexOf(`id: '${id}'`);
  return source.slice(start, start + 320);
};

describe('sidebar module status truth', () => {
  it.each(['MODULE_AUDITS', 'MODULE_MEETING'])(
    '%s is labelled beta rather than coming soon when its workspace is routable',
    (id) => {
      expect(moduleBlock(id)).toContain("badge: 'beta'");
      expect(moduleBlock(id)).not.toContain("badge: 'soon'");
    }
  );
});
