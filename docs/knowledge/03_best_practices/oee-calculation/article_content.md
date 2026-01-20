# OEE Calculation Best Practices: What You're Probably Getting Wrong

*Reading time: 4 minutes*

---

## The Most Misunderstood Metric

OEE — Overall Equipment Effectiveness — is manufacturing's universal metric. Every plant manager knows it. Every lean consultant talks about it.

Yet most companies calculate it incorrectly. And even those who calculate it right often fail to use it effectively.

Let's fix that.

## The OEE Formula

At its core, OEE is simple:

```
OEE = Availability × Performance × Quality
```

Each component is a percentage:

| Factor | Formula | What It Measures |
|--------|---------|------------------|
| **Availability** | (Run Time ÷ Planned Time) × 100 | Downtime losses |
| **Performance** | (Actual Output ÷ Theoretical Max) × 100 | Speed losses |
| **Quality** | (Good Units ÷ Total Units) × 100 | Defect losses |

Multiply the three percentages together, and you get OEE.

**Example**: 90% Availability × 95% Performance × 99% Quality = **85% OEE**

This is considered "world-class" — and it's harder to achieve than it looks.

## Common Calculation Mistakes

### 1. Wrong Availability Denominator

Availability should measure **unplanned** downtime against **planned production time**.

❌ **Wrong**: Including scheduled maintenance, breaks, or non-production shifts  
✅ **Right**: Only count time when the equipment was supposed to be running

### 2. Inflated Performance Speed

Performance should use the **true design speed** — what the equipment can actually achieve when running perfectly.

❌ **Wrong**: Using "normal" or "practical" speed from experience  
✅ **Right**: Use nameplate capacity or proven maximum from time studies

### 3. Counting Second-Pass Quality

Quality should measure **first-pass yield** — units that passed inspection on the first attempt.

❌ **Wrong**: Counting reworked units as "good"  
✅ **Right**: Only count units that required zero rework

## The Six Big Losses

OEE exists to expose and quantify the **Six Big Losses**:

| Loss Category | OEE Factor | Examples |
|---------------|------------|----------|
| Equipment Failure | Availability | Breakdowns, tool failures |
| Setup & Adjustment | Availability | Changeovers, warmup time |
| Idling & Minor Stops | Performance | Jams, feed issues, cleaning |
| Reduced Speed | Performance | Wear, operator caution |
| Process Defects | Quality | Scrap, out-of-spec product |
| Startup Losses | Quality | Defects during warmup |

When your OEE drops, don't just look at the number. Look at **which factor changed** — then investigate the corresponding losses.

## Real-Time vs. Reported OEE

Here's an uncomfortable truth: **spreadsheet OEE is usually wrong**.

When operators log downtime and output manually, several things happen:

- Short stops get forgotten or rounded
- Speed losses become "normal" and invisible
- Subjective categorization varies by shift

**Real-time OEE** — captured automatically from PLCs, sensors, and MES systems — tells a different story. It's accurate, consistent, and granular.

In our experience, real-time OEE is typically 5-15% lower than reported OEE. But it's also far more useful, because it shows you exactly where losses occur.

## OEE in Consultinity

The Consultinity MES and GEMBA modules calculate OEE automatically:

- **Real-time capture** from equipment signals
- **Drill-down** by shift, line, product, or operator
- **Loss categorization** aligned to the Six Big Losses framework
- **Trend analysis** with anomaly detection

You can view OEE at the plant level, then click through to see exactly which micro-stops contributed to a performance dip on a specific machine during a specific hour.

That's the level of visibility you need to actually improve — not just report.

## Key Takeaways

1. **Get the formula right**: Use correct denominators for each factor
2. **Focus on losses, not numbers**: OEE is a diagnostic tool, not a scorecard
3. **Capture in real-time**: Spreadsheet OEE hides the truth
4. **Drill down to root causes**: Aggregate numbers mean nothing without detail

## Ready to See Your Real OEE?

If you're still calculating OEE from spreadsheets, you're making decisions on incomplete data.

Start a [free Consultinity trial](https://consultinity.com/trial) and connect your equipment to the MES module. You'll see your real OEE — and the specific losses you can address — within days.

No more guessing. Just clarity.
