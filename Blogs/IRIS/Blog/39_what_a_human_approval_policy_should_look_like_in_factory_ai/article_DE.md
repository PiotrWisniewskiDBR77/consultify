# Wie eine menschliche Freigaberichtlinie fuer Werks-KI aussehen sollte

Target persona: Qualitaetssystem-Manager / Werksleiter / Legal- und Compliance-Partner  
Funnel stage: Decision  
Core problem: Teams verlassen sich auf informelle Gewohnheiten, wann ein Mensch unterschreiben muss, was bei Schichtwechsel, Urlaubsvertretung und Auditfragen bricht  
Main promise: ein Policy-Skelett zum Veroeffentlichen: Umfang, Schwellen, Evidence, Eskalation, Aufzeichnungen und Training gekoppelt an Workflows, nicht Modellnamen

Eine menschliche Freigaberichtlinie fuer Werks-KI soll festlegen, welche Workflow-Status eine benannte menschliche Freigabe brauchen, welche Evidence bei Freigabe sichtbar sein muss, wie lange Freigaben warten duerfen bevor Eskalation, wer Nacht und Wochenende abdeckt und wie Overrides protokolliert werden. Sie soll Risikoklassen und Reversibilitaet referenzieren, aber immer in konkreten Workflow-Feldern und Rollen landen. Spricht sie nur ueber "die KI", scheitert sie vor Audit und Flaeche. Policy ist absichtlich langweilig. Langweilig macht Betrieb vorhersagbar.

## Abschnitt 1: Umfang und Definitionen

Veroeffentlichen Sie: welche Workflows und Standorte die Policy abdeckt; Definitionen von watch, advise, act in Ihrer Werkssprache; welche Systeme System of Record fuer Freigaben sind. Vermeiden Sie Modell-Marketingnamen im Policy-Kern. Nutzen Sie Workflow- und Anlagensprache, die Auditoren kennen.

## Abschnitt 2: Freigabematrix nach Workflow-Status

Beispielform (anpassen):

| Workflow-Status | erlaubter KI-Modus | menschliches Gate | Freigeber-Rolle |
|---|---|---|---|
| Intake-Triage | advise | bestaetigen vor Task-Erstellung | Linienvorgesetzter |
| IH-Arbeitsauftrag Freigabe | advise | unterschreiben vor Dispatch | IH-Lead |
| Qualitaetssperre Disposition | advise oder act in Regel | Freigabe-Unterschrift | Qualitaetsmanager |
| Kundenversand-Override | nur advise | Dual-Sign | Qualitaet plus Logistik |

Leere Freigeber-Zellen sind Incident-Pfade.

## Abschnitt 3: Evidence-Paket zum Freigabezeitpunkt

Fordern Sie sichtbare Evidence, keine Stimmung: Signale oder Felder, die der Vorschlag nutzte; Unsicherheitsflags wenn vorhanden; aehnliche vergangene Faelle als Referenz, nicht als Autoritaet; explizite Reversibilitaet und Rollback-Schritt. Freigeber sagen koennen: "Ich sah X, deshalb signierte ich."

## Abschnitt 4: zeitbasierte Eskalation

Definieren Sie: maximale Wartezeit auf Freigabe nach Schwereband; wer bei Timer-Ueberschreitung automatisch eskaliert; was mit Act-Mode-Verhalten bei Rueckstau passiert. Stille Timeouts machen aus "das System entschied" ein Geruecht.

## Abschnitt 5: Abdeckung und Delegation

Decken Sie ab: benannte Nacht-Vertretungen; Urlaubsdelegationsregeln; Notfall-Downgrade auf nur-advise mit Trigger-Rolle. Ohne schriftliche Abdeckung entstehen Umgehungen mit persoenlichen Logins. Das zerstoert Nachvollziehbarkeit.

## Reality check: Freigabepolicy scheitert meist an Wochenenden, Abdeckungsluecken und Rueckstau

Die meisten Werke koennen im Workshop eine vernuenftige Freigaberegel schreiben. Der Test ist, ob sie weiter funktioniert:

- in der Nachtschicht, wenn der primaere Freigeber fehlt
- waehrend Rueckstau, wenn Vorgesetzte Warteschlangen schnell leeren
- nach einem Incident, wenn Auditoren einen sauberen Record statt sechs Erklaerungen wollen

Wenn die Policy diese Momente nicht uebersteht, ist sie noch Anleitung und keine Kontrolle.

## Abschnitt 6: Training und Rezertifizierung

Legen Sie fest: wer Policy-Training vor Freigaberechten abschliessen muss; jaehrliche oder post-incident Rezertifizierungs-Trigger; wie Auftragnehmer behandelt werden. Trainingsnachweise sind Teil der Policy, nicht HR-Dekor.

## Checklist: ist die Policy betrieblich?

- findet ein neuer Vorgesetzte seine Gates in unter fuenf Minuten?  
- kann Qualitaet die Policy ohne Vendor-Namen erklaeren?  
- kann IT eine Freigabe-Audit-Spur fuer eine Zufallswoche liefern?

Drei Mal "ja" bedeutet: nahe dran.

## Warum IRIS Freigaberichtlinien durchsetzbar macht

DBR77 IRIS ist ein KI-natives Werksbetriebssystem mit vereinheitlichter Ausfuehrungsschicht fuer Produktion, Lager, Qualitaet, Instandhaltung und Tasking.

Policies halten, wenn Freigaben, Evidence und Aufgaben einen operativen Datensatz teilen.

## Fazit

Schreiben Sie Freigaben in Workflow-Sprache mit benannten Rollen, Timern und Evidence. Wenn es auf der Flaeche nicht durchsetzbar ist, ist es keine Policy.

---

*Möchten Sie sehen, wie das in der Praxis funktioniert? [14-Tage-Trial starten](https://dbr77.com/iris) oder [Walkthrough ansehen](https://dbr77.com/demo).*
