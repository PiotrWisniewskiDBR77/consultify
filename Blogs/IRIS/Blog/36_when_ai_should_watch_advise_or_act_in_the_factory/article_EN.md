# When AI Should Watch, Advise, or Act in the Factory

Target persona: Operations Director / IT-OT Architect / Quality and Safety Lead  
Funnel stage: Decision  
Core problem: plants toggle between "AI does nothing" and "AI does too much" because they never publish operational modes tied to thresholds and accountability  
Main promise: a three-mode framework (watch, advise, act) mapped to signals, reversibility, and approval paths, separate from generic autonomy debates

The choice is not philosophy. It is threshold design aligned with liability. AI should watch when you need consistent detection and logging without changing workflow obligations. It should advise when humans must confirm before tasks, routings, or messages become binding. It should act only inside narrow, published rules—with audit trails, rollback paths, and explicit owners for exceptions. This complements risk-class decision rights; it answers deployment mode, not only who signs.

Watch mode means AI monitors streams, tags anomalies, and writes structured events without creating obligations for others unless a human or rule trigger fires. Use it when definitions are still stabilizing, when you need baseline false-positive rates, or when cultural trust is low but measurement is urgent. You are doing it right when the event catalog is reviewed weekly, supervisors can ignore alerts without breaking metric integrity, and noise trends down with reason-code discipline.

Advise mode means AI proposes ranked actions, drafts tasks, and suggests routings—nothing becomes binding until a human confirms or a second rule gate passes. Use it when cross-functional tradeoffs need judgment, when similar past cases help but are not law, or when you want speed without silent commitments. Proof shows up as measured time from suggestion to accept or reject, categorized overrides treated as learning signals, and drafts that reduce typing without skipping required fields.

Act mode means the system performs allowed operations automatically within caps: enqueue work, notify roles, escalate at timers, apply non-destructive routings. Use it when rules are frequent, boring, well-bounded, reversibility is fast, and failure modes are contained and visible. Healthy act mode cites rule versions, gives exception queues owners and SLAs, and includes pause switches for maintenance windows and incidents.

Pick starting modes with discipline. New lines or new feeds start in watch until definitions hold across shifts. Multi-team priority disputes start in advise until acceptance patterns are explainable. Repeat clerical routing with clean rules may graduate toward act only after audits stay clean across review cycles. Plants fail when they jump from watch to act because a vendor demo looked good.

Mode drift is usually operational, not technical. Teams believe they are still advising while the floor treats suggestions as binding because overload removes careful review, exception queues lack owners, or draft routing quietly behaves like auto-routing. Publish mode discipline in workflow rules—not in good intentions.

IRIS makes modes meaningful when watch, advise, and act attach to tasks, approvals, pause switches, and exception queues—so deployment mode is visible in the system, not buried in settings.

For shift and function governance around modes, see [How to Govern AI Decisions Across Shifts and Functions](../37_how_to_govern_ai_decisions_across_shifts_and_functions/article_EN.md). For approval gates, see [What a Human Approval Policy Should Look Like in Factory AI](../39_what_a_human_approval_policy_should_look_like_in_factory_ai/article_EN.md).

Watch measures, advise confirms, act obeys rules. Publish the mode per workflow—not per press release.

## The operational bottom line

The promise of this article—a three-mode framework (watch, advise, act) mapped to signals, reversibility, and approval paths, separate from generic autonomy debates—becomes operational only when it changes how work moves: clearer ownership, faster first assignment, and closure you can trace without inbox archaeology. For “When AI Should Watch, Advise, or Act in the Factory,” treat that as the acceptance test: the next shift should be able to read what happened, what was approved, and what remains open—without relying on verbal reconstruction.

Hold teams to a simple rule: if an improvement cannot be shown in exports from the execution record, it is not yet an operating improvement—only a narrative improvement. That rule keeps programs honest when demos look good but handovers still feel fragile.
If the record is thin, fix the record before you expand the ambition.

---

*DBR77 IRIS binds watch, advise, and act behaviors to workflow states, tasks, and approvals so modes are enforceable, not rhetorical. [Start 14-day trial](https://dbr77.com/iris) or [Start interactive demo](https://dbr77.com/demo).*
