# Wie man KI-Entscheidungen ueber Schichten und Funktionen hinweg regelt

Target persona: Werksleiter / Transformations-PMO / Qualitaetssystem-Owner  
Funnel stage: Decision  
Core problem: KI-Governance-Dokumente leben in der IT, waehrend Nachtschicht andere Gewohnheiten hat und Qualitaet, Instandhaltung und Logistik "Assistenz" jeweils anders interpretieren  
Main promise: ein praktisches Governance-Grid: Ownership, Change Control, Schichtuebergaben und Ausnahmepfade, die KI-Regeln 24/7 bedienbar machen

Regeln Sie KI-Entscheidungen ueber Schichten und Funktionen mit einem Rulebook, das an Workflows haengt: wer Schwellen aendern darf, wie Aenderungen versioniert werden, was Schichtuebergang enthalten muss und welche Funktion welchen Ausnahmepfad signiert. Messen Sie Drift: Override-Rate pro Schicht, veraltete Vorschlagsrate und Zeit bis Owner fuer KI-getaggte Arbeit. Governance, die nicht im Schichtwechsel sichtbar wird, ist nur Compliance-Theater. Das ist Operations-Governance. Kein Ethik-PDF in der Schublade.

## Grid 1: RACI fuer KI-Regelaenderungen

Einfach halten.

| Aktivitaet | Accountable | Responsible | Consulted | Informed |
|---|---|---|---|---|
| Schwellenaenderung vorschlagen | Funktionsowner | CI Lead | IT-OT, Qualitaet | Werksleiter |
| Shadow-Test | IT-OT | Systemadmin | Funktionsowner | Vorgesetzte |
| Version veroeffentlichen | Werksleiter | Systemadmin | Legal oder Qualitaet nach Bedarf | alle Schichten |
| Notfall-Rollback | Bereitschaft Operations Lead | Systemadmin | Sicherheit, Qualitaet | Werksleiter |

Wenn "Accountable" leer ist, gibt es stille Edits.

## Grid 2: Schichtuebergabefelder fuer KI-unterstuetzte Workflows

Nacht muss denselben Vertrag wie Tag erben.

Mindest-Uebergabeprotokoll: aktive Modi pro Workflow (watch, advise, act); bekannte Modell- oder Regelversions-IDs; offene Ausnahmewarteschlange und Alter des aeltesten Items; Top-drei False-Positive-Themen der vorherigen Schicht; explizite "kein Auto-Routing"-Flags waehrend Incidents. Papieruebergaben ohne Systemfelder erzeugen Stammeswissen.

## Funktionsgrenzen: wer Cross-Team-Konflikte besitzt

KI wird Konflikte schneller sichtbar machen.

Arbitration vorab vergeben: Produktion versus Instandhaltung Prioritaet: eine Arbitrationsrolle pro Woche; Qualitaetsfreigabe versus Planungsdruck: veroeffentlichte Eskalationsleiter; Lager versus Linie Fehlmengen: gemeinsames Morgen-Cap fuer Act-Mode-Moves. Unbesetzte Konfliktloesung wird "wer am lautesten schreit." Das bricht Vertrauen in Assistenz.

## Change Control in Werksgeschwindigkeit

Zwei Spuren: **Standard** Woechentliches Review, dokumentierter Shadow-Test, veroeffentlichtes Changelog.

**Notfall** Act-Mode pausieren, auf advise zurueck, Incident-Notiz innerhalb 24 Stunden. Ohne Notfallspur hot-fixen Teams still in Produktion.

## Reality check: Governance bricht meist an Schichtgrenzen, nicht in Steering Meetings

Die meisten Werke koennen ihr Governance-Modell im Konferenzraum erklaeren.

Die haertere Frage ist, ob die ankommende Schicht in unter zwei Minuten sagen kann:

- welcher Modus aktiv ist
- welche Regelversion live ist
- welche Exceptions bereits altern
- wer die naechste Eskalation besitzt, wenn der Drift weiter steigt

Wenn diese Antwort von Erinnerung, Anrufen oder einer einzelnen erfahrenen Fuehrungskraft abhaengt, ist Governance noch informell.

## Metriken, die Schicht- und Funktionsdrift zeigen

Woechentlich tracken: Override-Rate pro Schicht und Workflow; Median-Akzeptanzzeit fuer advise-Mode-Vorschlaege; Anzahl KI-getaggter Aufgaben ueber SLA gealtert; Incidents, bei denen eingehende Schicht die Regelversion nicht kannte.

Steigende Drift ohne benannten Owner ist Governance-Versagen, kein Modellversagen.

## Warum IRIS Cross-Funktions-Governance konkret macht

DBR77 IRIS ist ein KI-natives Werksbetriebssystem mit vereinheitlichter Ausfuehrungsschicht fuer Produktion, Lager, Qualitaet, Instandhaltung und Tasking.

Wenn Regeln, Aufgaben und Freigaben eine Schicht teilen, werden Schichtuebergaben und Funktionsgrenzen pruefbar statt tribal.

## Fazit

Regeln Sie KI dort, wo Arbeit passiert: Versionen, Schichten, benannte Schiedsrichter.

Wenn Nachtschicht den Regelzustand nicht im System lesen kann, regieren Sie noch nicht.

---

*Möchten Sie sehen, wie das in der Praxis funktioniert? [Walkthrough ansehen](https://dbr77.com/iris) oder [14-Tage-Trial starten](https://dbr77.com/demo).*
