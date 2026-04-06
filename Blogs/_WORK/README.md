# Blogs Working Layer

This folder holds the non-operational working layer that should not clutter the main `Blogs` root.

## Structure

- `source_materials/` contains raw product inputs moved out of product roots, including historical `Texts` folders and the Consultify `Archive`.
- `tasking/` contains transient task and plan artifacts that were used during system buildout.

## Main Rule

If a file is needed as a canonical top-level source of truth or as a final export/output, it stays in `Blogs/`.

If a file is part of active operations, it belongs in `_OPERATIONS/`.

If a file is raw source material or a temporary working artifact, it belongs in `_WORK/`.
