# Wie eine menschliche Freigaberichtlinie in Factory-KI aussehen sollte

Zielpersona: Quality-Systems-Manager / Plant Manager / Legal- und Compliance-Partner  
Funnel-Stufe: Decision  
Kernproblem: Teams verlassen sich auf informelle Gewohnheiten, wann ein Mensch unterschreiben muss—das bricht bei Schichtwechsel, Urlaubsvertretung und Auditfragen  
Hauptversprechen: Ein veröffentlichbarer Policy-Skeleton: Scope, Schwellen, Evidence, Eskalation, Records und Training, gebunden an Workflows, nicht Modellnamen

Eine menschliche Freigaberichtlinie für Factory-KI soll absichtlich langweilig sein. Langweilig macht Operations vorhersagbar. Sie soll festlegen, welche Workflow-States benannte menschliche Freigaben brauchen, welche Evidence bei Sign-off sichtbar sein muss, wie lange Freigaben vor Eskalation warten dürfen, wer Nächte und Wochenenden abdeckt und wie Overrides protokolliert werden. Sie soll Risiko und Reversibilität referenzieren, muss aber in konkreten Workflow-Feldern und Rollen landen. Spricht sie nur über „die KI“, scheitert sie an Audits und Shop Floor.

Gute Policies lesen sich für neue Vorgesetzte wie eine Checkliste, nicht wie ein Manifest: welches Feld muss gefüllt sein, welche Rolle darf unterschreiben, was passiert bei Timeout. Wenn Approver unter Druck raten müssen, ob sie überhaupt zuständig sind, ist die Policy noch nicht im Workflow angekommen — sie existiert nur als Dokument.

Starten Sie mit Scope und Definitionen: welche Workflows und Sites abgedeckt sind; was Watch, Advise und Act in Werkssprache bedeuten; welche Systeme System of Record für Freigaben sind. Vermeiden Sie Vendor-Marketing-Namen im Kerntext. Nutzen Sie Workflow- und Asset-Sprache, die Auditoren erkennen.

Bauen Sie eine Freigabe-Matrix nach Workflow-State. Leere Approver-Zellen sind Incident-Pfade. Jede Zeile beantwortet: welcher Mode erlaubt ist, welches menschliche Gate greift und welche Role signiert.

Fordern Sie ein Evidence-Paket zum Freigabezeitpunkt: genutzte Felder, Unsicherheitsflags, verknüpfte Referenzfälle als Kontext (nicht Autorität), Reversibilität und Rollback-Schritte. Approver sollen klar sagen können: „Ich sah X, deshalb signierte ich.“

Definieren Sie zeitbasierte Eskalation. Stille Timeouts machen aus „das System entschied“ Gerüchte. Nennen Sie Maximal-Waits nach Schwere, wer bei Timer-Bruch eskaliert und was mit Act-Mode während Backlog passiert.

Decken Sie Delegation ab: Nacht-Deputies, Urlaubsregeln, Notfall-Downgrade auf Advise-only mit expliziter Autorität. Ist Coverage nicht schriftlich, umgehen Menschen mit Shared Logins—und Traceability stirbt.

Policies scheitern meist an Wochenenden, Coverage-Lücken und Backlog—nicht in Workshops. Der Test ist, ob die Regel Nachtschicht-Abwesenheit, schnelles Queue-Clearing nach Rush und Post-Incident-Prüfung ohne sechs konkurrierende Stories übersteht.

Training und Rezertifikation gehören zur Policy: wer Training vor Freigaberechten abschließen muss, Trigger für jährliches oder post-incident Refresh, wie Contractor gehandhabt werden. Trainingsrecords sind Teil der Kontrolle, nicht HR-Deko.

**Operativer Policy-Check:** Findet ein neuer Vorgesetzte seine Gates in unter fünf Minuten? Kann Qualität die Policy erklären, ohne einen Vendor zu nennen? Kann IT eine Freigabe-Audit-Trail für eine zufällige Woche liefern? Dreimal ja—Sie sind nah dran.

IRIS macht Freigaberichtlinien durchsetzbar, wenn Evidence, Timer, Sign-offs und resultierende Tasks einen operativen Record teilen—Policy wird Floor-Level-Mechanismus.

Zu Entscheidungsrechtslogik siehe [Wann KI empfehlen soll und wann Menschen in Operations entscheiden sollen](../26_when_ai_should_recommend_and_when_humans_should_decide_in_operations/article_DE.md), [Wann KI im Werk beobachten, beraten oder handeln soll](../36_when_ai_should_watch_advise_or_act_in_the_factory/article_DE.md) und [Wie man KI-Entscheidungen über Schichten und Funktionen hinweg regiert](../37_how_to_govern_ai_decisions_across_shifts_and_functions/article_DE.md).

Schreiben Sie Freigaben in Workflow-Sprache mit benannten Rollen, Timern und Evidence. Ist es auf der Fläche nicht durchsetzbar, ist es keine Policy.

## Operatives Fazit

Das Versprechen dieses Artikels—ein veröffentlichbarer Policy-Skeleton: Scope, Schwellen, Evidence, Eskalation, Records und Training, gebunden an Workflows, nicht Modellnamen—wird erst operativ, wenn es die Art ändert, wie Arbeit fließt: klarere Ownership, schnellere erste Zuweisung und nachvollziehbarer Abschluss ohne Postfach-Archäologie. Für „Wie eine menschliche Freigaberichtlinie in Factory-KI aussehen sollte“ ist das der Akzeptanztest: Die nächste Schicht soll lesen können, was passierte, was freigegeben wurde und was offen bleibt—ohne mündliche Rekonstruktion.

Dieser Standard geht nicht um Software-Perfektion; er geht um operative Ehrlichkeit: weniger mysteriöse Übergaben, weniger Wahrheiten nur im Meeting und mehr Tage, an denen der System-Record zu dem passt, was die Fläche mitten in der Task sagen würde.

Halten Sie Teams an einer einfachen Regel: Wenn sich eine Verbesserung nicht in Exporten aus dem Ausführungsdatensatz zeigen lässt, ist es noch keine operative Verbesserung—nur eine Erzählung davon. Diese Regel hält Programme ehrlich, wenn Demos gut aussehen, Übergaben aber noch fragil wirken.

Ist der Record dünn, reparieren Sie den Record, bevor Sie den Ambitionsumfang erweitern.

---

*DBR77 IRIS speichert Freigaben, Evidence und Tasks zusammen, damit menschliche Gates über Schichten und Funktionen nachvollziehbar bleiben. [14-Tage-Trial starten](https://dbr77.com/iris) oder [Walkthrough ansehen](https://dbr77.com/demo).*
