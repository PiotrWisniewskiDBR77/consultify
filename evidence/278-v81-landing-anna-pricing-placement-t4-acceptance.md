# V8.1 Evidence - Landing Anna pricing placement T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna pricing placement`
Taxonomy: `T4`
Decision: `accepted`

## Acceptance statement

The bounded `Landing Anna pricing placement` packet is accepted.

## What is now true

1. `PricingView` exposes `AnnaAssistantWidget`
2. Anna demo/trial/contact handoffs on that page route through the page's existing public authority
3. focused regression coverage protects the page-level placement seam

## Remaining backlog after acceptance

1. Anna analytics, prompt-quality, multilingual breadth, and deeper voice implementation remain deferred
2. any separately promoted public-shell Anna breadth beyond the currently accepted pricing placement cut remains out of scope
