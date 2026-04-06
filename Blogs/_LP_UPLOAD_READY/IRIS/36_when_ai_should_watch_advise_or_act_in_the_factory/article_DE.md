# Wann KI im Werk beobachten, beraten oder handeln soll

Target persona: Operations Director / IT-OT-Architekt / Qualitaets- und Sicherheitsleitung  
Funnel stage: Decision  
Core problem: Werke kippen zwischen "KI macht nichts" und "KI macht zu viel", weil sie keine Betriebsmodi veroeffentlichen, die an Schwellen und Accountability gekoppelt sind  
Main promise: ein Drei-Moden-Rahmen (watch, advise, act) gemappt auf Signale, Reversibilitaet und Freigabepfade, getrennt von generischen Autonomie-Debatten

**Direct answer:** KI soll beobachten, wenn Sie konsistente Detektion und Protokollierung brauchen ohne Workflow-Status zu aendern. Sie soll beraten, wenn Menschen bestaetigen muessen, bevor Aufgaben, Routings oder Nachrichten den Entwurfszustand verlassen. Sie soll nur innerhalb enger, veroeffentlichter Regeln mit Audit Trail, Rollback-Pfaden und expliziten Ausnahme-Ownern handeln. Das ist keine Philosophie. Das ist Schwellendesign plus Haftungsalignment.

Das ergaenzt Risikoklassen fuer Entscheidungsrechte.

Es beantwortet Deploy-Modus, nicht nur wer unterschreibt.

## Modus 1: watch

**Definition**  
KI ueberwacht Stroeme, taggt Anomalien und schreibt strukturierte Events. Sie erzeugt keine Pflichten fuer andere ohne Mensch oder Regel-Trigger.

**Nutzen wenn**  
- Definitionen sich noch stabilisieren  
- Sie Baselines fuer False Positives brauchen  
- kulturelles Vertrauen niedrig ist, Messung aber dringend  

**Nachweis, dass es stimmt**  
- Event-Katalog wird woechentlich reviewed  
- Vorgesetzte koennen Alarme ignorieren ohne Metrikintegritaet zu brechen  
- Rauschtrend sinkt mit Grundcode-Disziplin  

## Modus 2: advise

**Definition**  
KI schlaegt priorisierte Aktionen vor, entwirft Aufgaben und Routings. Nichts wird verbindlich, bis ein Mensch bestaetigt oder ein zweites Regeltor greift.

**Nutzen wenn**  
- querfunktionale Tradeoffs Urteil brauchen  
- aehnliche Fallhistorie hilft, aber kein Gesetz ist  
- Sie Geschwindigkeit ohne stille Verpflichtungen wollen  

**Nachweis, dass es stimmt**  
- Medianzeit von Vorschlag bis Accept oder Reject wird gemessen  
- Overrides werden kategorisiert, nicht als peinliches Rauschen behandelt  
- Entwuerfe reduzieren Schreibzeit ohne Pflichtfelder zu ueberspringen  

## Modus 3: act

**Definition**  
Das System fuehrt erlaubte Operationen automatisch aus: Arbeit einreihen, Rollen benachrichtigen, nach Timern eskalieren oder nicht-destruktive Routings innerhalb Caps anwenden.

**Nutzen wenn**  
- Regeln langweilig, haeufig und klar begrenzt sind  
- Reversibilitaet schnell und guenstig ist  
- Fehlmodi eingrenzbar und sichtbar sind  

**Nachweis, dass es stimmt**  
- jede Auto-Aktion zitiert eine Regelversion  
- Ausnahmewarteschlangen haben Owner und SLA  
- Pause-Schalter existieren fuer Wartungsfenster und Incidents  

## Entscheidungsmatrix: Startmodus

| Situation | Start in | Hochstufen wenn |
|---|---|---|
| neue Linie oder neuer Datenfeed | watch | stabile Definitionen und gemessenes Rauschen |
| Teamkonflikte zur Prioritaet | advise | hohe Akzeptanz, erklaerbare Overrides |
| wiederholtes Routing mit sauberen Regeln | act | Audits zwei Review-Zyklen sauber  

## Uebergaben zwischen Modi

Werke scheitern, wenn sie von watch zu act springen, weil ein Vendor-Demo gut aussah.

Gesunde Sequenz:

1. watch bis Definitionen ueber Schichten halten  
2. advise bis Akzeptanz- und Override-Muster verstanden sind  
3. act nur auf der engsten Scheibe mit Caps  

## Reality check: Modusdrift ist meist ein Betriebsproblem, kein technisches

Viele Teams sagen, sie seien noch im advise-Modus.

Im Alltag beginnt das Werk Vorschlaege aber schon als verbindlich zu behandeln, weil:

- Teams ueberlastet sind und nicht mehr sorgfaeltig reviewen
- Ausnahmewarteschlangen keinen sichtbaren Owner haben
- niemand merkt, dass Entwurfsrouting sich bereits wie Auto-Routing verhaelt

Darum muss Modusdisziplin in Workflow-Regeln veroeffentlicht werden und darf nicht guten Absichten ueberlassen bleiben.

## Warum IRIS Modendisziplin unterstuetzt

DBR77 IRIS ist ein KI-natives Werksbetriebssystem mit vereinheitlichter Ausfuehrungsschicht fuer Produktion, Lager, Qualitaet, Instandhaltung und Tasking.

Modi zaehlen, wenn Assistenz an echte Aufgaben und Freigaben gekoppelt ist statt schwebender Vorschlaege in einem separaten Fenster.

## Fazit

Watch misst, advise bestaetigt, act innerhalb Regeln.

Modus pro Workflow veroeffentlichen, nicht pro Pressemitteilung.
