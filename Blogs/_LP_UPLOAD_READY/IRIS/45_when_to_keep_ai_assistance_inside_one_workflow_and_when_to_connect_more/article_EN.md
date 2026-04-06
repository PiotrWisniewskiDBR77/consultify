# When to Keep AI Assistance Inside One Workflow and When to Connect More

Target persona: Continuous Improvement Lead / MES Owner / Warehouse Systems Lead  
Funnel stage: Consideration  
Core problem: teams either isolate assistance in a narrow pilot forever, or connect everything at once and lose traceability on ownership and approvals  
Main promise: a decision grid based on data maturity, SLA risk, change-control load, and audit needs so scope moves in controlled steps

**Direct answer:** Keep AI assistance inside one workflow when definitions are unstable, training is incomplete, approvals are not mapped, or incident volume is already above team capacity. Connect more workflows only when the first workflow shows stable closure metrics for two review cycles, override reasons are trending down or explainable, and you can reuse the same audit fields without custom exceptions. Connection without closure discipline multiplies chaos faster than it multiplies value.

Breadth is easy to demo.

Depth is what keeps the plant safe.

## Grid: stay narrow versus expand connectors

| Signal | Stay narrow | Expand connectors |
|---|---|---|
| KPI definitions | disputed across functions | published and field-mapped |
| time-to-owner | rising week over week | flat or improving |
| override themes | new surprises each week | repeating, trainable codes |
| change control | informal edits | versioned publishes with owners |
| audit asks | cannot produce exports | exports ready on demand |

If three or more "stay narrow" signals are true, pause expansion.

## Step sequence: expansion gate (use before each new workflow)

1. freeze baseline for the live workflow for fourteen days  
2. run exception review: top fifteen themes with owners  
3. confirm approval paths cover night and weekend coverage  
4. map data lineage for the next workflow: source field, refresh rate, owner  
5. define rollback: how to detach assistance without losing history  
6. publish a go-live window and communication to affected shifts  

Skip a gate and you will pay in escalations.

## Comparison: integration sprint versus integration ladder

| Element | Sprint | Ladder |
|---|---|---|
| risk | concentrated blast radius | bounded per step |
| learning | noisy | attributable |
| audit trail | often reconstructed | built per step |
| vendor pressure | high | moderate |

Ladders feel slow until the first serious incident.

## Checklist: minimum readiness to connect a second workflow

- shared user roles tested on all shifts  
- identical override taxonomy or a documented mapping  
- incident linkage rule tested on at least one real event  
- training sign-off list current within thirty days  
- executive scorecard fields unchanged by the new connector  

## When staying narrow is the wrong strategy

- the isolated workflow creates duplicate data entry that operators already reject  
- safety or quality explicitly requires cross-function routing you are blocking  
- the vendor contract forces a bundled integration you cannot decouple  

In those cases, widen with a formal exception path and extra audit fields, not silently.

## Why IRIS supports a disciplined ladder

DBR77 IRIS matters here because expansion decisions get safer when closure behavior, override patterns, and audit fields stay measurable workflow by workflow inside one execution layer.

That lets the plant connect the next workflow by evidence rather than by vendor pressure or optimism.

If you need the neighboring mode and response-loop context, see [When AI Should Watch, Advise, or Act in the Factory](../36_when_ai_should_watch_advise_or_act_in_the_factory/article_EN.md), [How AI Can Reduce Downtime When Response Loops Exist](../33_how_ai_can_reduce_downtime_when_response_loops_exist/article_EN.md), and [How to Scale AI Assistance Without Losing Operational Control](../38_how_to_scale_ai_assistance_without_losing_operational_control/article_EN.md).

## Final takeaway

Connect the next workflow only when the last one closes cleanly enough to trust.

If you cannot trust closure yet, you should not trust breadth.
