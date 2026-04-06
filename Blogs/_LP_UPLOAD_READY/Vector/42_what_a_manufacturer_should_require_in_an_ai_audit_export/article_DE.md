# Was ein Hersteller in einem KI-Audit-Export verlangen sollte

Zielpersona: CISO / Leiter IT-Audit / Qualitaets- und Regulatory-Affairs-Fuehrung  
Trichterphase: Consideration  
Kernproblem: Lieferanten liefern Marketing-Bestaetigungen, waehrend der Betrieb rekonstruierbare Nachweise zu Konfiguration, Datenpfaden und Aenderungshistorie braucht  
Hauptversprechen: ein definierter Audit-Export verwandelt subjektives "vertrauen Sie uns" in pruefbare Artefakte, die Ihr Team zu Architekturdiagrammen in Beziehung setzen kann

Ein Audit-Export ist keine Logo-Folie.

Es ist ein strukturiertes Evidenzpaket, passend zu dem, wie Sie Kontrolle bereits in MES, Identity und Netzwerkreviews belegen.

## Direkte Antwort

Ein Hersteller sollte einen KI-Audit-Export verlangen, der Deployment-Topologie und Umgebungsinventar, Identity- und Rollen-Mappings mit Eskalationsregeln, Datenflussdiagramme mit tatsaechlichen Konnektoren, Modell- und Prompt-Versionshistorie mit Aenderungsprotokollen, Trainings- und Fine-Tuning-Policy-Nachweise inklusive Subprozessoren, Log-Retention und Zugriffskontrollen zur Rekonstruierbarkeit, menschliche Freigabe-Konfiguration pro Workflow-Klasse sowie Incident-Response-Kontakte mit vertraglichen SLAs umfasst. Verlangen Sie maschinenlesbare Formate wo moeglich, damit interne Tools Exporte quartalsweise vergleichen koennen.

Was sich nicht exportieren laesst, laesst sich nicht in Programmskala auditieren.

## Schrittfolge: Exportvertrag definieren

1. Veroeffentlichen Sie das Mindestschema, das Ihr Konzern erwartet, angepasst an ISO-artige oder interne Audit-Gewohnheiten.
2. Verhandeln Sie den Export als vertragliche Lieferung mit Aktualisierungsrhythmus, nicht als einmaliges PDF.
3. Fuehren Sie ein Tabletop durch: kann ein Drittpruefer eine Entscheidung allein aus Logs und Versionen rekonstruieren?
4. Binden Sie den Exportumfang nur an genehmigte Deployments, damit Schattenpfade als Luecken sichtbar werden.
5. Speichern Sie Quartals-Snapshots mit Hash oder Signatur, falls Ihre Policy Manipulationssicherheit verlangt.

## Rahmen: sieben Audit-Bundles

### Bundle 1: Topologie und Inventar

Hosts, Regionen, Netzzonen, Admin-Konsolen und wo welche Workloads laufen.

### Bundle 2: Identity und Zugriff

Rollen, Gruppen-Mappings, Break-Glass, Sitzungslaenge, MFA fuer privilegierte Pfade.

### Bundle 3: Datenpfade und Retention

Ingress, Egress, Verschluesselungszustaende, Retention-Uhren, Legal-Hold-Verhalten.

### Bundle 4: Modell- und Prompt-Linie

Gepinnte Routen, Versions-Tags, Promotionshistorie, wer welche Aenderung freigab.

### Bundle 5: Trainingsgrenzen-Nachweis

Schriftliche Policy plus technische Kontrollen, die Kundendaten vom Training ausschliessen.

### Bundle 6: Workflow-Governance

Workflow-Klassifikation, wo menschliche Freigabe sitzt, Ausnahmeregister falls vorhanden.

### Bundle 7: Betrieb

Config-Backups, Runbooks, Vendor-Support-Zugriffslogs.

## Checkliste: rote Flaggen in Lieferanten-Antworten

- erzaehlende PDFs ohne Konfigurations-IDs
- Weigerung, Trainings-Traffic von Inferenz-Telemetrie zu trennen
- Logs ohne Akteursidentitaet oder Korrelations-IDs
- "wir erklaeren live im Call" statt dauerhafter Exporte

## Produktbruecke

DBR77 Vector ist die sichere Intelligenzschicht hinter dem DBR77-Oekosystem: proprietaere Industrie-KI mit Deployments-Grenzen fuer private und isolierte Betriebsmodelle, trainiert auf Werks-Transformationswissen, ohne Kundendaten zum Modelltraining, mit industrieller Argumentation statt generischem Chat. Kauefer mit ernsthaften Audit-Programmen sollten Exporte erwarten, die zu dieser Architektur-Geschichte passen.

## Abschlussfazit

Auditierbarkeit ist eine Produktanforderung, kein Vertriebsgespraech.

Definieren Sie den Export, bevor Sie im Produktionsbetrieb vom System abhaengen.
