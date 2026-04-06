# Wie ein sauberer Uebergang von Auswahl zu Auslieferung aussehen sollte

Target persona: Projektmanager / Operations-Sponsor  
Funnel stage: Decision bis Delivery (Umsetzungsuebergang)  
Core problem: Auswahl-Gewinner kommen vor Ort, waehrend Operations, IT und Maintenance noch denken, das Projekt sei "Sache Einkauf"  
Main promise: ein Uebergabe-Paket und Meeting-Rhythmus, der Ownership, Schnittstellen und Akzeptanz-Kontinuitaet explizit macht

Auswahl endet mit einem Namen auf einer Folie.

Delivery startet mit einer Linie, die morgen noch laufen muss.

Die Luecke ist, wo Budgets lecken und Vertrauen bricht.

Ein sauberer Uebergang ist kein laengerer Vertragsanhang.

Es ist ein kurzer Satz Artefakte und Owner, der verhindert, dass das Projekt zu Ping-Pong zwischen Einkaeufer und Integrator wird.

## Direkte Antwort

Ein sauberer Uebergang enthaelt:

- einen integrierten Projektplan mit Meilensteinen gekoppelt an Akzeptanzobjekte
- ein RACI mit benannten Operations-, Maintenance-, IT-, Quality- und Safety-Ownern
- eine eingefrorene Konfigurationsbaseline (Hardware, Software-Build-IDs, Scope-Statement-Version)
- ein Kommunikationsprotokoll: Kadenz, Kanaele, Eskalationspfad
- einen 30-bis-60-Tage-Operations-Readiness-Plan (Training, Ersatzteile, Dokumentationskonsum)

Publizieren Sie es in einem internen Uebergabe-Meeting und einem Lieferanten-Kickoff mit demselben Deck-Skeleton.

Wenn nach Woche eins zwei Stories existieren, haben Sie Rework bereits bezahlt.

## Uebergabe-Pack-Checkliste (Minimum)

| Artefakt | Zweck |
| --- | --- |
| Scope-Statement-ID + Exclusions | verhindert stillen Drift |
| Schnittstellen-Register | verhindert IT-Fiktion |
| Risiko-Register mit Ownern | verhindert verwaiste Issues |
| Testplan-Outline bis FAT und SAT | verhindert spaete Ueberraschungen |
| Trainingsplan mit Audiences | verhindert unsupported Go-Live |
| Ersatzteilliste und Lead Times | verhindert Early-Downtime-Drama |

Fehlende Artefakte sollten als explizite Risiken mit Daten gelistet werden, nicht als Hoffnung.

## Uebergabe-Meeting-Agenda (90 Minuten, illustrativ)

1. was ausgewaehlt wurde und warum (Decision-Log-Summary)
2. welche Aenderungen erlaubt sind und wie (Change Control)
3. wer intern was besitzt (RACI-Walk)
4. was Lieferanten woechentlich vom Werk brauchen (Abhaengigkeitskarte)
5. wie "gruen" bei FAT und SAT aussieht (Akzeptanz-Anker)

Ende mit Action Items: Namen, Datum, eine ausgehende Lieferantennotiz, die dasselbe Verstaendnis bestaetigt.

## Was sich nach Uebergang aendert (Verhalten, kein Papier)

Nach Uebergang hoert der Einkaufsowner auf, der einzige Hals zu sein.

Operations spricht in woechentlicher Integrationskadenz.

Maintenance signiert Zugangs- und LOTO-Realitaet.

IT committet Netzwerk- und Credential-Timelines.

Einkauf ueberwacht kommerzielle Change-Disziplin, nicht taegliches Engineering-Trivia.

## Reality check: Uebergang scheitert meist dann, wenn die Organisation annimmt, der gewinnende Lieferant "hat das Projekt jetzt"

Diese Annahme klingt effizient.

Sie ist meist der Punkt, an dem Ownership zu verschwimmen beginnt.

Der Lieferant erwartet Inputs vom Werk.

Das Werk erwartet, dass der Lieferant jeden naechsten Schritt treibt.

Der Einkauf nimmt an, dass Execution bereits uebernommen hat.

Wenn nach der Auswahl niemand Ownership neu publiziert, erbt das Projekt einen Gewinner, aber kein funktionierendes Betriebsmodell.

## typische Uebergabe-Fehler

| Fehler | Kosten | Fix |
| --- | --- | --- |
| kein IT-Sitzplatz | Schnittstellen-Slips | Teilnahme erzwingen |
| Training als optional | Support-Load-Spikes | Training an Meilensteine binden |
| undocumented baseline | Scope-Streit | Build-IDs einfrieren |
| doppelte Narrative | Misstrauen | ein Kickoff-Deck |

## Was das fuer DBR77 Marketplace bedeutet

DBR77 Marketplace unterstuetzt hersteller-first Automatisierungseinkauf als Workflow von Challenge-Klarheit bis strukturiertem Vergleich.

Uebergang ist der Moment, wo Vergleichbarkeit zu Ausfuehrungsrealitaet wird.

Wenn Auswahl sauber dokumentiert ist, startet Delivery mit weniger versteckten Substitutionen.

Marketplace ist kein Roboterkatalog.

Es ist Vertrauen und Workflow-Schicht, die zu ernsthaften Werken passen sollte, die Projekte nach Award fuehren.

## Fazit

Auswahl ohne Uebergang ist eine Entscheidung ohne Owner.

Publizieren Sie das Paket, richten Sie den Kickoff aus und machen Sie FAT- und SAT-Kontinuitaet planbar statt heroisch.
