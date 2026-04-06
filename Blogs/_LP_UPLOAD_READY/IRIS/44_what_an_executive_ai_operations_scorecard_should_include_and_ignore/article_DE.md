# Was eine Executive-KI-Operations-Scorecard enthalten soll und ignorieren soll

Target persona: COO / Werks-P&L-Owner / VP Supply Chain  
Funnel stage: Evaluation  
Core problem: Leadership sieht Modell-Demos und Adoptions-Prozente, waehrend das Werk weiter Stunden an unklarem Ownership und langsamen Abschluss verliert  
Main promise: eine kurze Scorecard, die KI-Assistenz an Response, Durchsatzschutz, Audit-Readiness und menschliches Follow-through bindet und Vanity-Metriken filtert

**Direct answer:** Eine Executive-KI-Operations-Scorecard sollte Median Time-to-Owner fuer assistierte Items, Abschlussrate assistierter Tasks innerhalb SLA, Repeat-Incident-Rate nach Routing-Beruehrung durch Assistenz, Override-Rate mit kategorisierten Gruenden und Trainingsabdeckung nach Rolle enthalten. Sie sollte rohe Modell-Accuracy ohne Operations-Kontext, Leaderboard-artige Suggestion-Counts und "AI-Stunden gespart"-Claims ohne Baseline-Methode ignorieren. Wenn die Scorecard nicht in unter 30 Minuten aus Exports gebaut werden kann, ueberlebt sie echte Operationen nicht.

Executives brauchen keine weiteren Charts.

Sie brauchen weniger Zahlen, die trotzdem Verhalten vorhersagen.

## Enthalten: fuenf operative Outcomes (minimaler Executive-View)

1. Time-to-Owner: vom Signal zum benannten accountable Human  
2. Abschlussqualitaet: Prozent SLA-Abschluss mit Pflichtfeldern  
3. Durchsatzschutz: ungeplante Stop-Minuten mit Link zu assistierten Entscheidungen  
4. Repeat-Muster: gleiches Failure-Thema innerhalb 14 Tage  
5. Governance-Gesundheit: Schwellen-Aenderungen mit Freigaben und geloggten Versions-IDs  

Diese fuenf ueberleben Audits und Schichtwechsel.

## Ignorieren: fuenf Vanity-Spuren, die Risiko verstecken

1. Suggestion-Volumen ohne Accept- oder Dismiss-Disziplin  
2. Accuracy-Metriken ohne Safety- und Quality-Hold-Kontext  
3. "Automationsrate", die UI-Klicks zaehlt, nicht operative Zustaende  
4. Zufriedenheitsumfragen ohne Incident-Record-Linkage  
5. IT-Token-Kosten-Metriken im Operations-Review-Pack  

Vanity-Spuren klingen modern.

Sie fuehren keine Linie.

## Framework: woechentlich versus monatlich

| Metrik | Woechentliche Nutzung | Monatliche Nutzung |
|---|---|---|
| Time-to-Owner | Drift frueh fangen | Trend und Staffing-Entscheidungen |
| SLA-Abschluss | taktisches Follow-through | Prozess-Redesign-Trigger |
| Override-Gruende | Training und Schwellen-Edits | Policy-Updates |
| Repeat-Incidents | sofortige Eindammung | Engineering-Backlog-Prioritaet |
| Governance-Log-Volumen | Stichprobe Disziplin | Executive-Attestation |

Woechentlich ist fuer Vorgesetzte.

Monatlich ist fuer Kapital und Policy.

## Checkliste: Scorecard-Integritaetsregeln

- jede Metrik benennt das System-of-Record-Feld  
- Baselines sind datiert und fuer Vergleichsfenster eingefroren  
- Ausschluesse sind explizit (geplanter Downtime, Trials, Legacy-Linien)  
- rote Schwellen triggern einen Action-Owner, kein Diskussionsthema  
- maximal eine Seite fuer den Executive-Slice; Details im Anhang  

## Vergleich: Demo-Scorecard versus Operations-Scorecard

| Element | Demo-Scorecard | Operations-Scorecard |
|---|---|---|
| Datenquelle | kuratierte Screenshots | Exports und Logs |
| Erfolgsstory | Highlight-Reel | Median und Tail-Verhalten |
| Accountability | Projektteam | Linien- und Funktions-Owner |
| Entscheidungsnutzung | Funding-Narrativ | Schwellen- und Staffing-Edits |

Buyer erkennen den Unterschied schnell.

## Wann diese Scorecard funktioniert

- das Werk hat bereits einen disziplinierten woechentlichen Operations-Review  
- Assistenz ist an Tasks mit Ownern gebunden, nicht nur an Notifications  
- Finance akzeptiert operative Definitionen fuer Durchsatzmasse  

## Wann diese Scorecard in die Irre fuehrt

- Assistenz laeuft in einem Side-Channel ausserhalb des Ausfuehrungsdatensatzes  
- SLA-Definitionen differieren zwischen Schichten  
- Incidents werden verbal geschlossen ohne System-Linkage  

## Warum IRIS Scorecards an Ausfuehrungsrealitaet ausrichtet

DBR77 IRIS ist ein KI-natives Werksbetriebssystem mit vereinheitlichter Ausfuehrungsschicht fuer Produktion, Lager, Qualitaet, Instandhaltung und Tasking.

Wenn Assistenz Tasks in derselben Schicht wie Freigaben und Abschluesse erzeugt, streiten Executive-Metriken nicht mehr mit der Flaeche.

## Fazit

Wenn Leadership nicht erklaeren kann, wie eine Metrik eine Schwelle, einen Trainingsplan oder ein Staffing-Muster aendert, entfernen Sie sie von der Scorecard.

Halten Sie den View kurz, exportierbar und mit Owner.
