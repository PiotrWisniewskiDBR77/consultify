# Materials visual audit — 2026-08-06

Scope: Document Studio (Word), Workbook Studio (Excel), Deck Builder (PowerPoint), their template entry surfaces and the Kimi material shells.

## Findings and disposition

| Check                              | Result    | Disposition                                                                                                                                                |
| ---------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operational icons                  | Pass      | Surfaces use Lucide outline icons. A central `MATERIAL_VISUAL_IDENTITY` registry now owns Word / PowerPoint / Excel and corresponding template identities. |
| Emoji in product chrome            | Pass      | No Unicode pictograph remains in scoped source. The automated ratchet rejects it.                                                                          |
| Legacy raster / clip-art in chrome | Pass      | No literal PNG/JPG/GIF/WebP asset reference in scoped product chrome. User-authored images and actual material images remain supported.                    |
| Template identity                  | Pass      | Template launcher now resolves the three template identities through the canonical registry.                                                               |
| Builder rails and empty states     | Pass      | Structure actions have named 36 px targets and tooltips; empty states use restrained 24 px semantic Lucide anchors.                                        |
| Close controls                     | Pass      | Deck quality, share analytics and workbook history panels use the shared Lucide `X` pattern with an accessible name, tooltip and 36 px target.             |
| Misleading thumbnails              | Follow-up | Must be verified against every generated template during the manual runtime acceptance; static code cannot establish truthfulness of a generated preview.  |
| Empty/loading/error                | Follow-up | The shared standard is established. Each live empty/loading/error state requires screenshot verification in the final cross-tool runtime sweep.            |

## Enforced rule

Run `npm run lint:materials-visual` in CI/release validation. It blocks reintroduction of emoji-as-icons and literal legacy raster assets in the scoped materials editor and builder surfaces.

This is a ratchet, not a replacement for visual QA: it deliberately does not ban user content images, exported document imagery or a real brand mark.
