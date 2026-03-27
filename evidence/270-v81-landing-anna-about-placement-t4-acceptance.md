# V8.1 Evidence - Landing Anna about placement T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna about placement`
Taxonomy: `T4`
Decision: `accepted`

## Acceptance statement

The bounded `Landing Anna about placement` packet is accepted.

## What is now true

1. `AboutView` exposes `AnnaAssistantWidget`
2. Anna demo/trial/contact handoffs on that page route through the page's existing public authority
3. focused regression coverage protects the page-level placement seam

## Remaining backlog after acceptance

1. bespoke Anna placement on `Security` or pricing pages remains separate residual scope
2. Anna analytics, prompt-quality, multilingual breadth, and deeper voice implementation remain deferred
