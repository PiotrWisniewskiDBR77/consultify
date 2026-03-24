# MyWork Radar Briefings And Distribution v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac jak `Radar` uklada codzienne briefingi, listy priorytetow i kontrolowany push informacji do usera bez zamieniania systemu w spamujacy feed.

---

## 1. Why this document exists

Najlepszy `Radar` nie tylko znajduje sygnaly.

On jeszcze umie:

- ulozyc dzienny briefing,
- pokazac glowny storyline,
- przypomniec o sygnale we wlasciwym momencie,
- i nie przeciac usera dziesiecioma rownorzednymi kartami.

It must also:

- podpowiedziec, kiedy warto sie czegos douczyc,
- delikatnie zaprosic do rozmowy z AI,
- i zostawiac usera z poczuciem orientacji oraz energii, nie przeciazenia.

---

## 2. Inherited truth

This document inherits:

- `MYWORK_RADAR_V8_SSOT.md`
- `MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
- `MYWORK_RADAR_PERSONALIZATION_AND_ACTION_ENGINE_V8.md`
- `MYWORK_HOME_V1_SSOT.md`
- `ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`

Rule:

`distribution exists to deliver decision value, not content volume`

and:

`Radar should create forward motion and curiosity, not heaviness`

---

## 3. The briefing doctrine

The daily briefing is the executive front page of Radar.

It should:

- establish the dominant change signal of the moment
- give a short synthesis, not only a headline
- expose at least one actionable move
- allow expansion into supporting signals
- optionally surface one contextual learning move when action without understanding would be weak

The briefing must feel like:

- mini strategy memo
- consultant note for today
- decision context primer
- encouraging orientation layer for the next useful move

not:

- feed hero card
- carousel of unrelated stories
- gloomy alert center
- heavy research wall

---

## 4. Canonical briefing package

The baseline package includes:

- `mainInsight`
- `keySignals`
- `recommendedMove`

The package should also be able to carry:

- `learningPrompt?`
- `aiConversationInvite?`
- `ideaPrompt?`
- `notePrompt?`

This is already aligned with current runtime and remains canonical.

---

## 5. On-screen distribution model

The primary app distribution model is:

- one hero briefing
- one ranked stream of `what changed`
- one personal interpretation stream `why it matters to me`
- one explicit `what to do next`
- one `learn and improve` layer
- one watchlist layer

This creates a balanced mix of:

- urgency
- personalization
- actionability
- long-term learning
- confidence-building guidance

Tone rule:

`the screen should feel alive, clarifying and supportive, never punishing or emotionally heavy`

---

## 6. Notification doctrine

Radar notifications should be limited and high-signal.

Baseline notification rule:

- only high-importance or high-actionability signals should interrupt the user

Radar should notify for:

- high-impact signal with strong personal relevance
- watchlist-critical movement
- regulation or compliance shift with immediate relevance
- unusually strong opportunity worth immediate review
- high-value AI conversation invitation tied to an active task or decision

Radar should not notify for:

- low-impact educational content
- broad-interest news without current fit
- duplicate or stale stories
- generic `come back and read this` prompts with no current task relevance

---

## 7. Digest doctrine

The baseline digest forms are:

- `daily briefing`
- `top 3 signals`
- `action summary`

Where useful, the digest may include one:

- `learn this next`
- `talk this through with AI`
- `capture this as a note`
- `shape this into an idea`

Extensions may later include:

- weekly strategy memo
- team or role digest
- initiative-specific radar pack

But the `v8` baseline should stay disciplined and avoid overproduction.

---

## 8. Radar vs Inbox notifications

`Radar` notifications and `Inbox` are not the same thing.

Radar notifications mean:

- `worth looking at`
- `worth thinking about`
- `worth converting into action`
- `worth understanding now because it touches your work`

Inbox means:

- `you owe action`
- `governance requires response`
- `SLA or escalation is live`

This separation is non-negotiable.

---

## 9. Email and future channels

The baseline external channel is:

- email briefing

Future channels may include:

- mobile push
- manager digest
- assistant-spoken briefing
- AI chat-initiated nudge inside the app

But they must reuse one canonical Radar briefing contract instead of inventing channel-local copy.

AI chat nudge doctrine:

- AI may proactively invite a conversation about a Radar signal
- the nudge must reference the user's current work context
- the nudge must be optional and easy to dismiss
- the nudge should privilege clarity, confidence and usefulness over urgency theater

---

## 10. Reengagement pattern

Radar should pull the user back when:

- a previously important signal now escalates in relevance
- a watchlist item becomes materially important
- a suggested action was not yet converted and remains timely
- a timely AI conversation could improve an active task or decision
- a short knowledge refresh would materially improve the next move

Radar should not endlessly re-ping the same unresolved content without changed relevance.

Reengagement should feel like:

- `this can help you now`

not:

- `you still have unread content`

---

## 11. Success metrics

Distribution quality should be measured by:

- daily active use of Radar
- open rate of top signals
- `ask_ai` from Radar
- note creation from Radar
- idea creation from Radar
- `create_task` and `add_to_decision`
- repeat return after briefing
- depth of use without feed-browsing inflation
- use of knowledge-base or playbook follow-ups prompted by Radar
- completion of AI conversations started from Radar nudges
- evidence that Radar reduces confusion and increases readiness to act

Important:

`more clicks` is not enough.

The goal is:

`better decisions and better conversion into work`

and:

`more learning in context without making the product feel like homework`

---

## 12. Acceptance criteria

- Radar has one coherent briefing doctrine
- notifications remain selective and high-signal
- app, email and future channels reuse one common briefing contract
- Radar distribution stays separate from Inbox enforcement semantics
- Radar can include learning and AI-conversation invitations without becoming noisy
- the product tone remains light, encouraging and non-depressing
