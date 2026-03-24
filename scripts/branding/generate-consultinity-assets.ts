import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

function repoRoot() {
  // scripts/branding/* → repo root is two levels up
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveFirstExisting(paths: string[]) {
  for (const filePath of paths) {
    if (await exists(filePath)) return filePath;
  }

  return null;
}

async function renderPngFromSvg(params: {
  svgPath: string;
  outPath: string;
  width?: number;
  height?: number;
  contain?: boolean;
  backgroundTransparent?: boolean;
}) {
  const { svgPath, outPath, width, height, contain = true, backgroundTransparent = true } = params;

  const bg = backgroundTransparent ? { r: 0, g: 0, b: 0, alpha: 0 } : undefined;

  const img = sharp(svgPath, { density: 300 }).png();
  const resized =
    width || height
      ? img.resize({
          width,
          height,
          fit: contain ? 'contain' : 'cover',
          background: bg,
          withoutEnlargement: false,
        })
      : img;

  await ensureDir(path.dirname(outPath));
  await resized.toFile(outPath);
}

async function writeJson(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function main() {
  const root = process.cwd(); // run from repo root
  const sourceDir = path.join(root, 'Logo consultinity');

  // Source-of-truth SVGs
  const logoLightSvg = await resolveFirstExisting([path.join(sourceDir, 'consultify-black.svg')]);
  const logoDarkSvg = await resolveFirstExisting([
    path.join(sourceDir, 'consultify-white.svg'),
    path.join(sourceDir, 'consultify-white.svg.svg'),
  ]);
  const logoPurpleSvg = await resolveFirstExisting([path.join(sourceDir, 'consultify-purple.svg')]);
  const logoHarvardSvg = await resolveFirstExisting([path.join(sourceDir, 'consultify-harvard.svg')]);
  const iconSvg = await resolveFirstExisting([
    path.join(sourceDir, 'consultify-icon.svg'),
    path.join(sourceDir, 'Consultinity FaviconApp Icon light 1.svg'),
  ]);

  const missing: string[] = [];
  for (const [label, filePath] of [
    ['logo-light', logoLightSvg],
    ['logo-dark', logoDarkSvg],
    ['logo-brand-1e0058', logoPurpleSvg],
    ['logo-brand-92004f', logoHarvardSvg],
  ] as const) {
    if (!filePath) missing.push(`${label} (missing SVG in ${path.relative(root, sourceDir)})`);
  }
  if (missing.length) {
    throw new Error(
      `Missing source SVG(s):\n${missing.map((m) => `- ${m}`).join('\n')}`
    );
  }

  // Derived output locations (runtime)
  const outLogosDir = path.join(root, 'public', 'assets', 'logos');
  const outIconsDir = path.join(root, 'public', 'icons');

  // 1) App/UI logos
  // Keep runtime filenames stable while sourcing them from the new SVG wordmarks.
  await ensureDir(outLogosDir);
  await fs.copyFile(logoLightSvg!, path.join(outLogosDir, 'logo-light.svg'));
  await fs.copyFile(logoDarkSvg!, path.join(outLogosDir, 'logo-dark.svg'));
  await fs.copyFile(logoPurpleSvg!, path.join(outLogosDir, 'logo-brand-1e0058.svg'));
  await fs.copyFile(logoHarvardSvg!, path.join(outLogosDir, 'logo-brand-92004f.svg'));

  await renderPngFromSvg({
    svgPath: logoLightSvg!,
    outPath: path.join(outLogosDir, 'logo-light.png'),
    height: 128,
  });
  await renderPngFromSvg({
    svgPath: logoDarkSvg!,
    outPath: path.join(outLogosDir, 'logo-dark.png'),
    height: 128,
  });

  if (iconSvg) {
    await renderPngFromSvg({
      svgPath: iconSvg,
      outPath: path.join(outLogosDir, 'logo-icon.png'),
      width: 512,
      height: 512,
      contain: true,
    });

    // 2) Favicons (PNG-based; simple & reliable across browsers)
    await renderPngFromSvg({
      svgPath: iconSvg,
      outPath: path.join(root, 'public', 'favicon.png'),
      width: 32,
      height: 32,
    });
    await renderPngFromSvg({
      svgPath: iconSvg,
      outPath: path.join(root, 'public', 'favicon-16.png'),
      width: 16,
      height: 16,
    });

    // 3) PWA icons
    const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512] as const;
    await ensureDir(outIconsDir);
    for (const size of iconSizes) {
      await renderPngFromSvg({
        svgPath: iconSvg,
        outPath: path.join(outIconsDir, `icon-${size}.png`),
        width: size,
        height: size,
        contain: true,
      });
    }

    // Shortcut icons (use same mark; can be customized later)
    for (const name of ['shortcut-mywork', 'shortcut-new', 'shortcut-dashboard'] as const) {
      await renderPngFromSvg({
        svgPath: iconSvg,
        outPath: path.join(outIconsDir, `${name}.png`),
        width: 96,
        height: 96,
        contain: true,
      });
    }

    // 4) manifest.json (single canonical manifest; sw.js caches /manifest.json)
    const manifestIcons: ManifestIcon[] = iconSizes.map((size) => ({
      src: `/icons/icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: size === 192 || size === 512 ? 'any maskable' : 'any',
    }));

    const manifest = {
      name: 'Consultinity',
      short_name: 'Consultinity',
      description: 'AI-powered enterprise decision intelligence',
      start_url: '/',
      display: 'standalone',
      theme_color: '#0b1c2d',
      background_color: '#0f172a',
      scope: '/',
      lang: 'en',
      categories: ['business', 'productivity'],
      icons: manifestIcons,
      shortcuts: [
        {
          name: 'My Work',
          short_name: 'My Work',
          description: 'View tasks and priorities',
          url: '/my-work',
          icons: [{ src: '/icons/shortcut-mywork.png', sizes: '96x96', type: 'image/png' }],
        },
        {
          name: 'New Initiative',
          short_name: 'New',
          description: 'Create a new initiative',
          url: '/initiatives/new',
          icons: [{ src: '/icons/shortcut-new.png', sizes: '96x96', type: 'image/png' }],
        },
        {
          name: 'Dashboard',
          short_name: 'Dashboard',
          description: 'Open dashboard',
          url: '/pmo-dashboard',
          icons: [{ src: '/icons/shortcut-dashboard.png', sizes: '96x96', type: 'image/png' }],
        },
      ],
    };

    await writeJson(path.join(root, 'public', 'manifest.json'), manifest);
  } else {
    // eslint-disable-next-line no-console
    console.log('[branding] No icon SVG found in Logo consultinity/, skipping favicon and PWA icon generation.');
  }

  // eslint-disable-next-line no-console
  console.log('[branding] Generated Consultinity assets successfully.');
  // eslint-disable-next-line no-console
  console.log(`- Logos: ${path.relative(root, outLogosDir)}/logo-{light,dark}.svg + .png`);
  // eslint-disable-next-line no-console
  console.log(`- Brand accents: ${path.relative(root, outLogosDir)}/logo-brand-{1e0058,92004f}.svg`);
  if (iconSvg) {
    // eslint-disable-next-line no-console
    console.log(`- Icon: ${path.relative(root, outLogosDir)}/logo-icon.png`);
    // eslint-disable-next-line no-console
    console.log(`- Favicons: public/favicon.png, public/favicon-16.png`);
    // eslint-disable-next-line no-console
    console.log(`- PWA icons: ${path.relative(root, outIconsDir)}/icon-*.png`);
    // eslint-disable-next-line no-console
    console.log(`- Manifest: public/manifest.json`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

