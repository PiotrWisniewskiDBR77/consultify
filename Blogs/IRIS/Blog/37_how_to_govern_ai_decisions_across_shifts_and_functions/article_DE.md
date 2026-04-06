# Wie man KI-Entscheidungen über Schichten und Funktionen hinweg regiert

Zielpersona: Werksleiter / Transformations-PMO / Quality-Systems-Owner  
Funnel-Stufe: Decision  
Kernproblem: KI-Governance-Dokumente leben in IT, während Nachtschicht mit anderen Gewohnheiten läuft und Qualität, Instandhaltung und Logistik „Assist“ jeweils anders interpretieren  
Hauptversprechen: Ein praktisches Governance-Grid: Ownership, Change Control, Schichtübergaben und Ausnahmepfade, die KI-Regeln 24/7 operabel machen

Regieren Sie KI-Entscheidungen dort, wo Arbeit passiert—nicht in einem PDF, das um zwei niemand öffnet. Veröffentlichen Sie ein Rulebook, gebunden an Workflows: wer Schwellen ändern darf, wie Änderungen versioniert werden, was Schichtübergabe erfassen muss und welche Funktion welchen Ausnahmepfad signiert. Messen Sie Drift dann über Override-Rates je Schicht, stale Suggestion Rates und Time-to-Owner für KI-getaggte Arbeit. Governance, die Schichtwechsel nicht überlebt, ist Compliance-Theater. Das ist Operations-Governance.

Wenn Nacht und Tag unterschiedliche „informelle“ Regeln fahren, ist das kein Kulturproblem allein — es ist ein Hinweis, dass das Rulebook zu abstrakt ist oder Änderungen zu leise passieren. Machen Sie Regelupdates sichtbar wie ein Wartungsfenster: kurz, klar, mit Pflichtlektüre für die nächste Übergabe.

Halten Sie Accountability für Regeländerungen klar. Jemand muss für Vorschlagen, Testen, Veröffentlichen und Rollback von Schwellen-Edits rechenschaftspflichtig sein. Ist „accountable“ leer, gibt es stille Edits und nicht nachvollziehbare Überraschungen. Emergency Rollback muss real sein: Act-Mode pausieren, auf Advise zurück, Incident innerhalb eines Tages dokumentieren. Ohne Emergency-Track hot-fixen Teams Produktion leise—und Audits erben das Chaos.

Schichtübergabe muss denselben Vertrag wie Tag erben. Mindest-Sichtbarkeit umfasst aktive Modi pro Workflow, bekannte Regel- oder Modellversions-IDs, Exception-Queue-Tiefe und -Alter, Top-False-Positive-Themen der Vor-Schicht und explizite Flags bei Incidents, die Auto-Routing deaktivieren. Papier-Summaries können ergänzen; sie können Systemfelder nicht ersetzen, ohne Tribal Knowledge neu zu erzeugen.

KI-Oberflächen beschleunigen Konflikte—also Arbitration vorbelegen. Benennen Sie wöchentlich einen Schiedsrichter für Produktions-versus-Instandhaltungs-Prioritätsstreitigkeiten, veröffentlichen Sie Eskalationsleitern für Quality-Release versus Termindruck und begrenzen Sie gemeinsame Act-Mode-Moves bei Lager-versus-Linien-Engpässen, wenn Risiko hoch ist. Unbesetzte Konfliktlösung wird Volumen-Wettbewerb. Das frisst Vertrauen in Assistenz.

Change Control braucht zwei Geschwindigkeiten: einen Standard-Wochenrhythmus mit Shadow-Testing und veröffentlichtem Changelog sowie einen Emergency-Pfad, der Safety und Kontinuität priorisiert. Fabriken bewegen sich schnell; Governance muss schnell sein, ohne Records aufzugeben.

Die meisten Werke können Governance im Konferenzraum erklären. Der härtere Test: Kann die eingehende Schicht in unter zwei Minuten sagen, welcher Mode aktiv ist, welche Regelversion live ist, welche Ausnahmen altern und wer die nächste Eskalation besitzt, wenn Drift weitergeht. Braucht das Gedächtnis oder einen Anruf, ist Governance noch informell.

Tracken Sie wöchentliche Signale: Overrides je Schicht und Workflow, mediane Accept-Zeit im Advise-Mode, KI-getaggte Tasks jenseits SLA, Incidents, bei denen die eingehende Schicht die Regelversion nicht kannte. Steigender Drift ohne benannten Owner ist Governance-Failure—kein Modell-Failure.

IRIS macht Governance konkret, wenn Versionen, Tasks, Freigaben und Übergabe-State in einem operativen Layer leben—damit Tag, Nacht, Qualität und Instandhaltung denselben Vertrag erben statt ihn lokal neu zu erfinden.

Zu Deployment-Modi siehe [Wann KI im Werk beobachten, beraten oder handeln soll](../36_when_ai_should_watch_advise_or_act_in_the_factory/article_DE.md). Zu Skalen-Kontrollen nach Governance siehe [Wie man KI-Assistenz skaliert, ohne operative Kontrolle zu verlieren](../38_how_to_scale_ai_assistance_without_losing_operational_control/article_DE.md).

Regieren Sie KI dort, wo Arbeit passiert: Versionen, Schichten und benannte Schiedsrichter. Kann Nachtschicht den Regel-State im System nicht lesen, regieren Sie noch nicht.

## Operatives Fazit

Das Versprechen dieses Artikels—ein praktisches Governance-Grid: Ownership, Change Control, Schichtübergaben und Ausnahmepfade, die KI-Regeln 24/7 operabel machen—wird erst operativ, wenn es die Art ändert, wie Arbeit fließt: klarere Ownership, schnellere erste Zuweisung und nachvollziehbarer Abschluss ohne Postfach-Archäologie. Für „Wie man KI-Entscheidungen über Schichten und Funktionen hinweg regiert“ ist das der Akzeptanztest: Die nächste Schicht soll lesen können, was passierte, was freigegeben wurde und was offen bleibt—ohne mündliche Rekonstruktion.

Dieser Standard geht nicht um Software-Perfektion; er geht um operative Ehrlichkeit: weniger mysteriöse Übergaben, weniger Wahrheiten nur im Meeting und mehr Tage, an denen der System-Record zu dem passt, was die Fläche mitten in der Task sagen würde.

Halten Sie Teams an einer einfachen Regel: Wenn sich eine Verbesserung nicht in Exporten aus dem Ausführungsdatensatz zeigen lässt, ist es noch keine operative Verbesserung—nur eine Erzählung davon. Diese Regel hält Programme ehrlich, wenn Demos gut aussehen, Übergaben aber noch fragil wirken.

---

*DBR77 IRIS legt Regel-Modi, Versionen, Tasks und Freigaben in einem Layer offen, damit Schichtübergaben und Funktions-Ownership für Operations sichtbar bleiben. [Walkthrough ansehen](https://dbr77.com/iris) oder [14-Tage-Trial starten](https://dbr77.com/demo).*
