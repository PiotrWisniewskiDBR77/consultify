# Wann IoT eine Supervisor-Eskalation ausloesen sollte und wann nicht

Zielpersona: Produktionsvorgesetzter / Bereichsleitung / Werksleitung Operations  

Funnel-Phase: Consideration Kernproblem: Vorgesetzte werden in jeden gelben Ausschlag gezogen, Eskalation wird zum Rauschen und die Flaeche hoert auf, Alarme ernst zu nehmen Hauptversprechen: eine Supervisor-Eskalationspolicy: welche maschinengestuetzten Bedingungen Fuehrung unterbrechen, welche bei der Linie bleiben und wie Overrides die Regel aendern Vorgesetzte sollten kein menschlicher Alarm-Router sein.

Wenn IoT denselben Stream wie Bediener sendet, haben Sie nur ein zweites Postfach hinzugefuegt. Eskalation ist eine Governance-Entscheidung, keine Default-Einstellung im Sensor-Stack.

Loesen Sie **Supervisor-Eskalation** aus, wenn eine Bedingung aendert, wer den naechsten sicheren Schritt entscheiden darf, oder wenn die Linie ihr schriftliches Playbook innerhalb eines definierten Zeitfensters ausgeschoepft hat.

Loesen Sie **keine** Supervisor-Eskalation aus fuer Lernsignale, Einzelspitzen ohne Bestaetigung oder Bedingungen, die die Schicht mit einem bestehenden Arbeitsauftragspfad schliessen kann. Sichtbarkeit kann auf dem Screen bleiben. Eskalation sollte selten genug sein, um glaubwuerdig zu bleiben.

## Bediener-Notify von Supervisor-Interrupt trennen

Entwerfen Sie zwei Kanaele: **Bedienerkanal**: schneller Kontext, lokale Verifikation, Standardreaktionen; **Supervisorkanal**: Autoritaetswechsel, risiko ueber Schichten, Kunden- oder Sicherheits-Exposure, Ressourcenkonflikt.

Wenn beide Kanaele dieselben Events erhalten, trainieren Vorgesetzte, IoT zu ignorieren.

## Eskalationsmatrix

| Bedingung | Eskalation zum Supervisor wenn |
|---|---|
| Ungeplanter Stopp | unbekannte Ursache nach vereinbarter Check-Sequenz oder Wiederholungsmuster in derselben Woche |
| degradierendes Signal | Trend kreuzt werksdefiniertes Limit UND Instandhaltungs-Backlog blockiert Reaktion |
| Qualitaetsproxy | Ausschussrisiko kreuzt mit Qualitaetsleitung vereinbarten Schwellwert |
| Override aktiv | Override laeuft ohne Schliessungsplan ab |
| Sicherheit oder Compliance | jede Verletzung nicht verhandelbarer Standards |

| Bedingung | Supervisor meist nicht eskalieren |
|---|---|
| Erster Schwellwert auf neuer Baseline | loggen, pruefen, tunen |
| Einzel-Sensor-Spike | zuerst bestaetigen |
| kleine Zyklusvarianz | beobachten bis Muster entsteht |
| Vendor-Demo-Alarm | deaktivieren oder umklassifizieren |

## Schrittfolge: Eskalationsvertrag definieren

Fuenf Stopp-Szenarien listen, die Ihr Werk ohne IoT schon ernst nimmt; jedes mappen auf: nur Bediener, Instandhaltungs-Ticket, Supervisor-Interrupt; Timeboxen ergaenzen: wie lange die Linie das Problem besitzt, bevor eskaliert wird; Override-Regeln veroeffentlichen: wer Timeboxen verlaengern darf und wie lange; monatlich mit Signalqualitaets-Stichproben reviewen, nicht nur mit Alarmzaehlern.

## Checkliste: Eskalation vertrauenswuerdig halten

- [ ] Supervisor-Alarme sind Teilmenge der Bediener-Alarme, kein Duplikat-Feed
- [ ] jeder Supervisor-Alarm hat eine benannte naechste Autoritaetsaktion
- [ ] Eskalationsgruende sind fuer Planungsreviews codiert, nicht nur fuer Heatmaps
- [ ] falsche Eskalationen erhalten RCA wie Safety-Near-Miss-Reviews
- [ ] Standards referenzieren: Sicherheit, Qualitaet, Lieferung, Regulatorik

## Wann Echtzeit-Sichtbarkeit den Eskalationspfad nicht aendern soll

Echtzeit-Sichtbarkeit hilft frueher zu sehen. Sie hebt nicht automatisch die Schwere.

Wenn Sichtbarkeit allein eskaliert, ueberlasten Sie Vorgesetzte in normalen Varianzwochen.

## Was das fuer DBR77 IoT bedeutet

DBR77 IoT ist **Echtzeit-Maschinensichtbarkeit** mit **Edge-first Entscheidungsunterstuetzung**, kein Dashboard, das alle gleich pingt.

Retrofit-freundliche Konnektivitaet laesst Eskalationsregeln auf Brownfield-Assets ausrichten, ohne vollstaendiges Steuerungs-Rewrite.

Schnelle Piloten testen Supervisor-Last in einem Bereich vor Standardisierung.

## Bottom line

Supervisor-Eskalation sollte **selten, codiert und an Autoritaet gebunden** sein.

IoT gewinnt Vertrauen, wenn die Flaeche sieht, dass Fuehrung nur bei Bedingungen unterbricht, die die naechste sichere Entscheidung wirklich aendern.
