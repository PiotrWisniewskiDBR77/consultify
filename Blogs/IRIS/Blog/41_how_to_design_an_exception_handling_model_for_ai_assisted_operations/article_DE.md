# Wie man ein Exception-Handling-Modell für KI-unterstützte Operations entwirft

Zielpersona: Operations Architect / Werksingenieur-Leiter / Quality-Systems-Owner  
Funnel-Stufe: Consideration  
Kernproblem: KI-Assistenz erhöht Event-Volumen, aber Werke routen Ausnahmen weiter über informelle Chats—Response-Ownership und Abschluss-Loops bleiben unklar  
Hauptversprechen: Ein kompaktes Exception-Modell mit typisierten Pfaden, Schwellen, Freigaben und Audit-Feldern, das Vorgesetzte unter Last fahren können

Unterstützte Operations scheitern selten, weil das Modell am ersten Tag falsch ist. Sie scheitern, weil Ausnahmen zu einem zweiten Schattenprozess werden—schnelle Signale ohne passenden Execution-Pfad, Grenzfälle, die Menschen früher still absorbierten, und Volumen, das zu Anrufen wird, weil das offizielle Modell nie eine fünfte Spur hatte. Entwerfen Sie Ausnahmen mit Absicht—sonst entwirft sie die Fläche für Sie.

Wenn Assistenz live geht, erwarten Sie mehr Task-Kandidaten, mehr Near-Threshold-Streit und mehr „fast auto“-Routen, die einen menschlichen Stempel brauchen. Ohne Exception-Layer werden informelle Kanäle zum echten System.

Ein brauchbares Modell klassifiziert assistierte Outputs in wenige Pfade. Auto-Task innerhalb veröffentlichter Schwellen erzeugt einen Task mit Regelversion und Timestamp und schließt mit erledigter Arbeit oder verifiziertem State. Nur-Advise-Signale brauchen menschlichen Claim, mit explizitem Dismiss oder Convert-to-Task auch bei Reject. Eskalationspfade greifen bei SLA-Risiko, Safety, Quality-Holds oder funktionsübergreifendem Konflikt—jeweils mit Tier-Owner und Frist. Hard Stops gelten bei regulatorischen Sperren, Kunden-Constraints oder unreifen Daten—mit Freigabe-Rollen, Evidence-Links und Release-Kriterien. Erscheint in der Praxis ein fünfter Pfad („frag den Engineer“), ist Ihr Modell unvollständig.

Vor Go-Live definieren Sie eine Exception-Taxonomie, eine Ownership-Matrix je Schicht, eine zeitbasierte Eskalationsleiter, Freigabe-Regeln mit Deputy-Coverage, Übergabefelder, die die nächste Schicht im System sehen muss, einen Rollback-Hook, der assisted Routing pausiert ohne Audit-Historie zu verlieren, und eine Post-Incident-Schleife, die Schwellen- oder Trainings-Updates erzwingt, wenn Muster wiederkehren.

Ticket-Kultur loggt Aktivität. Abschluss-Kultur beendet operative States. KI-Assistenz verstärkt Ticket-Kultur, es sei denn, Tasks binden an Outcomes: Time-to-Owner, Time-to-Closure und Evidence, dass die Linie safe, sortiert und dokumentiert ist.

Rollout ruhig: Exceptions shadow-tagen ohne Auto-Routing, wöchentliche Themen reviewen, Version eins nur für wenige Workflows veröffentlichen, Time-to-Owner und Repeat-Eskalationen messen, Rulebook versionieren, wenn Schwellen sich bewegen.

Messbarkeit ist hier der Unterschied zwischen „wir haben ein Modell“ und „wir betreiben es“. Wenn Time-to-Owner steigt, während Volumen gleich bleibt, ist Ihr Exception-Pfad überlastet oder unklar — fixen Sie Routing, nicht nur Stimmung. Wenn Repeat-Eskalationen clustern, haben Sie entweder eine fehlende Policy oder eine Schichtlücke in der Freigabe-Abdeckung. Diese Kurven sollten im Ops-Review genauso sichtbar sein wie Produktionszahlen, sonst wird Exception-Handling zur permanenten Feuerwehr.

IRIS passt zum Exception-Layer, wenn Assistenz, Tasks, Freigaben und Abschluss-Proof einen Execution Record teilen—Exception-Design wird Operating Contract statt Chat-Archäologie.

Zu benachbartem Hardening siehe [Wann ein Werk einen operativen Schiedsrichter für widersprüchliche Signale braucht](../42_when_a_factory_needs_one_operational_arbiter_for_conflicting_signals/article_DE.md), [Wie man audit-fähige Records für KI-unterstützte Werksentscheidungen erstellt](../46_how_to_create_audit_ready_records_for_ai_assisted_factory_decisions/article_DE.md) und [Wie vollständiger operativer Abschluss in einer KI-nativen Fabrik aussehen sollte](../50_what_full_operational_closure_should_look_like_in_an_ai_native_factory/article_DE.md).

Exception-Volumen ist auch Diagnostik. Clustern sie um fehlende Felder, ist Intake unreif. Um Policy-Konflikte, sind Definitionen nicht aligned. Um Nachtschicht-Coverage, ist Ihr Freigabe-Modell unrealistisch. Ein gutes Exception-Modell ist nicht nur ein Router; es ist ein Sensor, der Führung zeigt, wo das Operating System noch fragil ist—bevor Fragilität zu Stillstand wird.

Vorgesetzte adoptieren Exception-Pfade nur, wenn sie schneller sind als der informelle Pfad. Time-Boxes müssen real sein, Owner erreichbar, Eskalation muss Erleichterung bringen—nicht eine weitere Schleife. Ist der offizielle Exception-Pfad langsamer als der Lieblings-Engineer-Anruf, wird der Engineer zum System. Designen Sie für diese Wettbewerbsrealität.

Exception-Design ist Ownership-Design. Benennen Sie Responder, Time-Boxes und Abschlussfelder—dann kann das Werk höheres Assistenz-Volumen absorbieren ohne Kontrolle zu verlieren.

## Operatives Fazit

Das Versprechen dieses Artikels—ein kompaktes Exception-Modell mit typisierten Pfaden, Schwellen, Freigaben und Audit-Feldern, das Vorgesetzte unter Last fahren können—wird erst operativ, wenn es die Art ändert, wie Arbeit fließt: klarere Ownership, schnellere erste Zuweisung und nachvollziehbarer Abschluss ohne Postfach-Archäologie. Für „Wie man ein Exception-Handling-Modell für KI-unterstützte Operations entwirft“ ist das der Akzeptanztest: Die nächste Schicht soll lesen können, was passierte, was freigegeben wurde und was offen bleibt—ohne mündliche Rekonstruktion.

Dieser Standard geht nicht um Software-Perfektion; er geht um operative Ehrlichkeit: weniger mysteriöse Übergaben, weniger Wahrheiten nur im Meeting und mehr Tage, an denen der System-Record zu dem passt, was die Fläche mitten in der Task sagen würde.

---

*DBR77 IRIS hält Assistenz, Tasks, Freigaben und Exceptions auf einem Execution Record, damit Pfade und Ownership über Schichten sichtbar bleiben. [Interaktive Demo starten](https://dbr77.com/iris) oder [14-Tage-Trial starten](https://dbr77.com/demo).*
