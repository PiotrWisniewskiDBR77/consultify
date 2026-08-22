# Wave 3 — owner policy decisions before guided replay

Date prepared: `2026-08-22`

These are the only two policy choices that would otherwise interrupt the guided
module replay. They do not authorize production, providers, publication or
third-party content use.

## W3-MAT-POL-001 — Materials restricted acceptance scope

Recommended decision:

> For Wave 3 owner review, accept the restricted, local native-format scope:
> canonical DOC/DOCX, PPT/PPTX, XLSX and explicitly described presentation PDF
> semantics. Keep external renderers/providers and any template, font or image
> whose rights are not proven outside the accepted scope. This is not a blanket
> rights waiver and does not authorize production publication.

If accepted, Piotr reviews:

- populated document authoring, checkpoint/version/restore and cold reopen;
- populated presentation builder, slide content, notes and history;
- populated spreadsheet values, formulas, revision and restore;
- truthful provenance, quarantine and unavailable-provider states.

Piotr does not review as implemented:

- new external document, slide or spreadsheet providers;
- unproven third-party templates, fonts or images;
- unsupported visual-PDF parity claims;
- production publishing, public sharing or mobile.

Status: `OWNER_DECISION_REQUIRED`

## W3-AUD-POL-001 — Audits internal-pack acceptance scope

Recommended decision:

> For Wave 3 owner review, accept only the internal, unlicensed Transformation
> Audit Pack and its canonical evidence, finding, corrective-action, report and
> initiative-proposal lifecycle. Keep named external standards and compliance
> claims disabled until a methodology and rights owner explicitly approves them.

If accepted, Piotr reviews:

- the internal pack and program;
- the `TA.1` requirement-to-evidence chain;
- finding ownership and independent review;
- approved corrective action;
- draft report and draft initiative proposal;
- unmistakable draft/approved state and separation of duties.

Piotr does not review as implemented:

- ISO, SOC, DORA or other named-standard methodology packs;
- certification or regulatory-compliance claims;
- external methodology providers;
- production rights, release or mobile.

Status: `OWNER_DECISION_REQUIRED`

## Recording rule

An acceptance response must name the decision ID and one of:

- `ACCEPT_RECOMMENDED_SCOPE`;
- `CHANGE_REQUIRED`, followed by the exact boundary change;
- `DEFER_MODULE`.

Only after that response may the corresponding module G00 be updated. Technical
evidence must not be used to infer the owner's policy decision.

