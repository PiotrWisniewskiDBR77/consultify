# Wie Daten-Ownership in einem KI-nativen Werksbetriebssystem aussehen soll

Target persona: CIO / IT-OT-Architekt / Data-Governance-Lead  
Funnel stage: Consideration  
Core problem: "alle besitzen Daten" heisst, niemand fixt Definitionen, Refresh-Fails oder Lineage-Luecken, wenn Modelle und Regeln wachsen  
Main promise: eine praktische Ownership-Map fuer Quellsysteme, kuratierte Operations-Definitionen, Assist-Outputs und Audit-Trails mit explizitem RACI

**Direct answer:** Daten-Ownership in einem KI-nativen Werksbetriebssystem sollte einen einzigen accountable Owner pro Operations-Definitionsfamilie benennen (z.B. OEE-Scope, Downtime-Reason-Tree, Standort-Master), einen verantwortlichen Steward fuer taegliche Qualitaet und konsultierte Parteien pro konsumierendem Workflow. Assist-Outputs erben Ownership des Workflows, den sie beruehren, nicht des Modell-Vendors. Refresh-SLAs, Exception-Handling fuer stale Feeds und Rechte zur Versions-Publikation muessen schriftlich sein. Wenn zwei Teams dieselbe Schwelle ohne Changelog-Eintrag aendern duerfen, haben Sie kein Ownership, sondern geteilte Schuld.

KI erzeugt keine neuen Daten.

Sie zeigt, wer den alten Datenvertrag vernachlaessigt hat.

## Map 1: drei Ownership-Schichten

| Schicht | Accountable | Responsible | typischer Fail |
|---|---|---|---|
| Quell-Feeds | Lead Plant Data Council | Systemadmin pro Quelle | stiller Schema-Drift |
| Operations-Definitionen | Funktionsowner (Prod, Qual, WH) | CI-Analyst | KPI-Streit |
| Assistenz-Konfiguration | Werksleiter | cross-funktionales Config-Team | Shadow-Schwellen-Edits |

Accountable genehmigt Publishes.

Responsible fixt taegliche Brueche.

## Checkliste: Definitions-Paket (publish bevor Modelle darauf tunen)

- Definition in Klartext und Ausschluesse  
- Feld-Mapping auf Quelltabellen oder Tags  
- Refresh-Kadenz und maximal akzeptabler Lag  
- bekannte Verzerrungen und Kompensationen  
- Change-Fenster und Kommunikationsregel fuer Operateure  

Pakete verhindern "das Modell ist falsch"-Debatten, die eigentlich Definitionskaempfe sind.

## Framework: Vendor-Daten versus werks-eigene Daten

| Datentyp | Werk muss besitzen | Vendor darf betreiben |
|---|---|---|
| Schwellen und Freigabe-Klassen | ja | nur unter Vertrag und Logging |
| Operateur-Notizen und Claims | ja | nie |
| Modell-Gewichte und Prompts | Policy und Evaluation | Execution-Hosting optional |
| roher Maschinenstrom | Zugriffs- und Retention-Regeln | Erfassungs-Appliance |

Wenn der Vertrag zu Logs schweigt, vom Schlimmsten ausgehen und fixen.

## Schrittfolge: Ownership-Reset-Workshop (halber Tag)

1. Top-10-KPIs listen, die in assistierten Workflows genutzt werden  
2. je einen accountable Owner zuweisen, keine geteilten Titel  
3. Feeds und Lag pro KPI mappen  
4. einen einzigen Publish-Pfad fuer Definitions-Aenderungen vereinbaren  
5. monatlichen Data-Health-Review mit Red-Flags, die an Aktionen gebunden sind  

## Wann zentrale IT-Ownership allein scheitert

- Operations wartet im Stop nicht auf Tickets  
- Definitionen brauchen woechentlich Shopfloor-Urteil  
- IH und Qualitaet streiten ueber dieselben Event-Labels  

Kombinieren Sie IT-Accountability mit Funktions-Stewards auf der Flaeche.

## Warum IRIS Ownership in der Ausfuehrung sichtbar macht

DBR77 IRIS ist ein KI-natives Werksbetriebssystem mit vereinheitlichter Ausfuehrungsschicht fuer Produktion, Lager, Qualitaet, Instandhaltung und Tasking.

Wenn Definitionen, Tasks und Assistenz-Konfiguration Lineage in einer Schicht teilen, schrumpfen Ownership-Streitereien und Fix-Tickets werden schneller.

## Fazit

Ownership ist wer publiziert, wer Lag fixt und wer Auditoren antwortet.

Schreiben Sie es in RACI, nicht in Slogans.
