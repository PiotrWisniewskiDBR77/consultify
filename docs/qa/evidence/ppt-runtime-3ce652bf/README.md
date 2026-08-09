# PowerPoint manual-authoring runtime evidence — `3ce652bf`

Date: 2026-08-07
Environment: deployed Consultify browser runtime

## PASS

1. Mounted slide layout selector changed layout, saved, and survived cold reload.
2. Pointer + modifier keyboard input selected multiple blocks.
3. Group and Ungroup completed from the selected-set controls.
4. Align and Distribute completed for freeform blocks and survived reload.
5. Pointer Move, Resize and Rotate handles changed geometry and survived reload.
6. Keyboard movement changed geometry and survived reload.
7. At 1280 px, left/right rails, command row and slide thumbnails remained visible and usable.

## FAIL

None observed in the acceptance path above.

## Not claimed by this runtime smoke

- arbitrary named-master picker;
- full organization image-library/crop/focal/mask workflow;
- visual 16:9 PDF parity;
- destructive version restore;
- forced concurrent-conflict, offline and save-failure recovery.
