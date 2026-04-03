# What Data Should You Collect from Machines?

Target persona: Plant Manager / Operations Leader  
Funnel stage: Awareness  
Core problem: many plants either collect too little machine data to improve operations or collect too much without a clear model for action  
Main promise: the right machine data set is not the biggest one, but the one that helps the plant detect losses, explain deviations, and respond within the same shift

Most factories do not fail because they collect too little data.

They fail because they collect the wrong data, in the wrong structure, for the wrong timing.

That usually creates one of two bad outcomes: the plant stays blind to the losses that matter most; the plant drowns in signals that nobody turns into action. That is why the real question is not: "How much data can we collect?" It is:

"What data helps the plant make better decisions fast enough to change the shift?"

## Start with operational decisions, not with sensors

Many IIoT projects start from the hardware side: which sensors to add; which gateway to install; which protocol to connect. That is understandable, but strategically weak.

The stronger starting point is: what does the plant need to know earlier; what losses does it need to explain; what decisions are still happening too late. Only then does the data model become useful.

## The first layer: machine state and basic event truth

For most plants, the first priority is not advanced analytics. It is basic event truth.

That means capturing: machine running; machine stopped; changeover; breakdown; idle or waiting.

Without this layer, the plant cannot build trustworthy visibility around downtime, utilization, or shift performance.

This is also why many plants still live with "unknown downtime." They see the stop, but not the operational truth around it.

## The second layer: cycle and output reality

Once machine state is visible, the next important layer is production rhythm: cycle time; actual output; planned versus actual pace; micro-stoppages or repeated interruptions. This matters because many losses do not look dramatic in isolation.

They accumulate through small delays, unstable cycles, or hidden slowdowns that never get enough attention in post-shift reporting.

The plant needs to see not only whether the machine is on, but whether it is performing the way it should.

## The third layer: downtime reasons and human context

Signal alone is rarely enough. The system may detect that a machine stopped. It often cannot explain why without operator or process context.

That is why useful machine data should also include: downtime reason declarations; operator confirmation; context about material, tooling, or quality conditions. This is not a weakness of automation.

It is a recognition that operational truth is often part signal, part human explanation.

When both are connected, the plant gets something much more valuable than a stop count. It gets usable cause visibility.

## The fourth layer: quality and process deviation

Once the plant can see machine state and throughput clearly, it can extend into: scrap events; defect occurrence; process anomalies; quality-relevant signals.

This is where the business starts moving from visibility toward faster correction.

It also helps prevent the common mistake of treating OEE as enough on its own.

If the system shows performance but not quality-related loss or anomaly patterns, decisions still arrive too late.

## The fifth layer: escalation and response triggers

One of the biggest mistakes in machine data programs is stopping at measurement. The plant should not only collect signals. It should know when signals should trigger action.

That means useful data architecture should support: thresholds; alerts; escalation; tasking or follow-up.

Otherwise the organization builds a reporting layer, not a control loop. And that is where many IIoT efforts lose momentum after the first excitement.

## Reality check: plants often over-collect because asking for one more signal feels easier than sharpening one better decision

Another tag sounds harmless. Another data stream looks potentially useful. Another engineering variable feels safer to keep than to reject. But unless someone can name the shift decision it should improve, the plant is usually adding future confusion faster than present control.

## What data should not be the first priority

Many teams try to collect everything at once: every possible sensor stream; every environmental variable; every engineering datapoint. That usually slows the project down. The better principle is:

collect the smallest data set that can improve the most important operational decision. That usually means starting with: state; stops; cycle; output; reason.

Then expanding only when the plant can already use the first layer well.

## Brownfield changes the answer

The data model must respect plant reality.

In brownfield environments, the perfect data model is often the wrong one if it requires: infrastructure replacement; invasive integration; long technical dependency chains. This is why retrofit-friendly collection matters. A usable first truth from an older line is often more valuable than a perfect future architecture that arrives too late.

## What better machine data looks like in DBR77 IIoT

DBR77 IIoT is useful here because it is not positioned as another dashboard layer.

Its value is in helping plants connect: machine signals; operator context; OEE logic; alerts and escalation; same-shift response.

That is the difference between collecting data and creating operational visibility that the plant can actually use.

## Bottom line

The best machine data set is not the one with the highest volume.

It is the one that helps the plant: see losses sooner; explain them more honestly; respond before the shift is gone.

That is the standard worth using when deciding what data to collect from machines.

---

*DBR77 IoT helps plants start with the minimum useful machine data set and turn it into same-shift visibility, alerts, and action. [Plan a pilot](https://dbr77.com/iot) or [See online demo](https://dbr77.com/demo).*
