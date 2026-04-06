# Wann KI im Werk beobachten, beraten oder handeln soll

Zielpersona: Operations Director / IT-OT-Architekt / Quality- und Safety Lead  
Funnel-Stufe: Decision  
Kernproblem: Werke pendeln zwischen „KI macht nichts“ und „KI macht zu viel“, weil sie nie operative Modi veröffentlichen, die an Schwellen und Accountability gebunden sind  
Hauptversprechen: Ein Drei-Moden-Rahmen (watch, advise, act), gemappt auf Signale, Reversibilität und Freigabepfade—getrennt von generischen Autonomie-Debatten

Die Wahl ist keine Philosophie. Sie ist Schwellen-Design aligned mit Haftung. KI soll beobachten, wenn Sie konsistente Detektion und Logging brauchen, ohne Workflow-Pflichten zu ändern. Sie soll beraten, wenn Menschen bestätigen müssen, bevor Tasks, Routings oder Nachrichten bindend werden. Sie soll nur innerhalb enger, veröffentlichter Regeln handeln—mit Audit-Trails, Rollback-Pfaden und expliziten Ownern für Ausnahmen. Das ergänzt risikoklassenbasierte Entscheidungsrechte; es beantwortet Deployment-Mode, nicht nur wer unterschreibt.

Watch-Mode bedeutet: KI überwacht Streams, taggt Anomalien und schreibt strukturierte Events, ohne Pflichten für andere zu erzeugen, bis ein menschlicher oder Regel-Trigger feuert. Nutzen Sie ihn, wenn Definitionen noch stabilisieren, wenn Sie Baseline-False-Positive-Rates brauchen oder wenn kulturelles Vertrauen niedrig, Messung aber dringlich ist. Sie machen es richtig, wenn der Event-Katalog wöchentlich reviewed wird, Vorgesetzte Alerts ignorieren können, ohne Metrik-Integrität zu brechen, und Rauschen mit Reason-Code-Disziplin abnimmt.

Advise-Mode bedeutet: KI schlägt gerankte Aktionen vor, entwirft Tasks und schlägt Routings vor—nichts wird bindend, bis ein Mensch bestätigt oder eine zweite Regel-Gate passiert. Nutzen Sie ihn, wenn funktionsübergreifende Tradeoffs Urteil brauchen, wenn ähnliche Fälle helfen aber nicht Gesetz sind, oder wenn Sie Speed ohne stille Verpflichtungen wollen. Nachweis ist gemessene Zeit von Vorschlag bis Accept/Reject, kategorisierte Overrides als Learning-Signale und Entwürfe, die Tippen reduzieren ohne Pflichtfelder zu überspringen.

Act-Mode bedeutet: Das System führt erlaubte Operationen automatisch innerhalb von Caps aus: Work einreihen, Rollen benachrichtigen, bei Timern eskalieren, nicht-destruktive Routings anwenden. Nutzen Sie ihn, wenn Regeln häufig, langweilig, gut begrenzt sind, Reversibilität schnell ist und Failure Modes eingrenzbar und sichtbar sind. Gesunder Act-Mode zitiert Regelversionen, gibt Exception-Queues Owner und SLAs und enthält Pause-Schalter für Wartungsfenster und Incidents.

Wählen Sie Start-Modi mit Disziplin. Neue Linien oder Feeds starten in Watch, bis Definitionen über Schichten halten. Multi-Team-Prioritätsstreitigkeiten starten in Advise, bis Akzeptanzmuster erklärbar sind. Wiederholtes clerical Routing mit sauberen Regeln darf erst nach sauberen Audits über Review-Zyklen Richtung Act wandern. Wer von Watch zu Act springt, weil ein Vendor-Demo gut aussah, scheitert.

Mode-Drift ist meist operativ, nicht technisch. Teams glauben noch zu beraten, während die Fläche Vorschläge als bindend behandelt, weil Überlast sorgfältiges Review entfernt, Exception-Queues keine Owner haben oder Draft-Routing leise wie Auto-Routing wirkt. Veröffentlichen Sie Mode-Disziplin in Workflow-Regeln—nicht in guten Absichten.

IRIS macht Modi sinnvoll, wenn Watch, Advise und Act an Tasks, Freigaben, Pause-Schaltern und Exception-Queues hängen—damit Deployment-Mode im System sichtbar ist, nicht in Settings vergraben.

Zu Shift- und Funktions-Governance um Modi siehe [Wie man KI-Entscheidungen über Schichten und Funktionen hinweg regiert](../37_how_to_govern_ai_decisions_across_shifts_and_functions/article_DE.md). Zu Freigabe-Gates siehe [Wie eine menschliche Freigaberichtlinie in Factory-KI aussehen sollte](../39_what_a_human_approval_policy_should_look_like_in_factory_ai/article_DE.md).

Watch misst, Advise bestätigt, Act gehorcht Regeln. Veröffentlichen Sie den Mode pro Workflow—nicht pro Pressemitteilung.

## Operatives Fazit

Das Versprechen dieses Artikels—ein Drei-Moden-Rahmen (watch, advise, act), gemappt auf Signale, Reversibilität und Freigabepfade, getrennt von generischen Autonomie-Debatten—wird erst operativ, wenn es die Art ändert, wie Arbeit fließt: klarere Ownership, schnellere erste Zuweisung und nachvollziehbarer Abschluss ohne Postfach-Archäologie. Für „Wann KI im Werk beobachten, beraten oder handeln soll“ ist das der Akzeptanztest: Die nächste Schicht soll lesen können, was passierte, was freigegeben wurde und was offen bleibt—ohne mündliche Rekonstruktion.

Halten Sie Teams an einer einfachen Regel: Wenn sich eine Verbesserung nicht in Exporten aus dem Ausführungsdatensatz zeigen lässt, ist es noch keine operative Verbesserung—nur eine Erzählung davon. Diese Regel hält Programme ehrlich, wenn Demos gut aussehen, Übergaben aber noch fragil wirken.

Ist der Ausführungsdatensatz dünn, reparieren Sie den Datensatz, bevor Sie den Ambitionsumfang erweitern.

---

*DBR77 IRIS bindet Watch-, Advise- und Act-Verhalten an Workflow-States, Tasks und Freigaben, damit Modi durchsetzbar sind, nicht rhetorisch. [14-Tage-Trial starten](https://dbr77.com/iris) oder [Interaktive Demo starten](https://dbr77.com/demo).*
