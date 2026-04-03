# Wie man nicht verhandelbare KI-Anforderungen in Enterprise-Beschaffung schreibt

Zielperson: Beschaffungsleitung mit IT- und Legal-Partnern Trichterphase: Entscheidung Kernproblem: RFQs kopieren generische Sicherheitssprache, die Anbieter mit Checkbox-Antworten erfuellen koennen, waehrend Training, Subprozessoren und Datenpfade offen bleiben Hauptversprechen: Ein straffer Anforderungsanhang macht Trainingspolitik, Deployments-Grenzen, Audit-Rechte und Incident-Pflichten vor Unterschrift durchsetzbar

Beschaffung ist der Ort, wo abstrakte Richtlinie zu Vertragswirklichkeit wird. Schwache Sprache erzeugt schwache Kontrollen.

Schreiben Sie nicht verhandelbare KI-Anforderungen als nummerierten Anhang zu Zweckbindung der Verarbeitung, Verbot oder enge Erlaubnis fuer Training und menschliche Pruefung, Subprozessoren und Aenderungsankuendigung, Deployments-Pflichten, Logging und forensische Kooperation, Ausnahmen von Haftungshoechstgrenzen bei Vertraulichkeitsverletzungen sowie Exit-Datenvernichtung mit Nachweis. Markieren Sie jede Klausel als bestanden oder nicht, nicht als Erzaehlaufsatz. Wenn es nicht im Anhang steht, steht es nicht im Deal.

## Anforderungsanhang: zwoelf Klauseln

**Zweckbindung**: KI verarbeitet Kundendaten nur fuer benannte Dienste; **Trainingsausschluss**: Standard kein Training auf Kundeninhalten; Ausnahmen nur mit Opt-in-Umfang und Dauer; **Fine-Tuning-Grenzen**: falls erlaubt, verbotene Datenklassen fuer Tuning-Saetze festlegen; **Menschliche Pruefung**: wenn Vendor-Personal Prompts oder Outputs sehen darf, Faelle, Regionen, Aufbewahrung definieren; **Subprozessoren**: genehmigte Liste oder Vorabgenehmigung mit Mindestankuendigungsfrist; **Regionen**: feste Allowlist fuer Speicher, Inferenz, Support-Zugriff, Backups; **Deployments-Verpflichtung**: On-Premise, private API oder isolierter Mandant vertraglich, nicht optional beim Go-Live; **Sicherheitsbaseline**: Referenz auf Ihr Enterprise-Control-Framework per ID, nicht nur vages SOC-Wording; **Logging**: Mindestereignisse, Aufbewahrung, Kundenzugriff, Exportformat; **Incidents**: Kategorien, Meldeuhr, Root-Cause-Kooperation, regulatorische Unterstuetzung wo relevant; **Audits**: Frequenz, Umfang, Remediation-Fristen fuer kritische Befunde; **Exit**: Datenrueckgabe, kryptographischer Wipe-Nachweis, Modell-Artefakt-Loeschung wo Kundendaten haetten bleiben koennen.

## Checkliste: Anbieterantworten bewerten

Pro Klausel verlangen:

- [ ] explizites Konform oder dokumentierte Ausnahme
- [ ] Referenz auf technische Kontrolle oder Diagramm-Exhibit
- [ ] benannte Subprozessoren falls relevant

Marketing-Anhaenge zaehlen nicht.

## Vergleich: weiche RFQ-Sprache vs durchsetzbare Sprache

| Weich | Durchsetzbar |
|---|---|
| "Anbieter wahrt angemessene Sicherheit" | "Anbieter implementiert Kontrollen in Exhibit A und weist jaehrlich Konformitaet nach" |
| "Kundendaten sind geschuetzt" | "Kundeninhalt in Scope X trainiert keine globalen Modelle gemaess Abschnitt 4.2" |
| "Private Cloud verfuegbar" | "Produktionsinferenz laeuft nur in Region Y Mandant Z ohne Admin-Crossover" |

## Wann man gehen sollte

Gehen wenn der Anbieter Trainingsausschluesse fuer Ihre hoechsten Datenklassen verweigert oder Subprozessoren ueber Nacht ohne Remediation-Frist wechseln koennen.

## Produktbruecke

DBR77 Vector ist als sichere Intelligenzschicht hinter dem DBR77-Oekosystem positioniert: proprietaere industrielle KI mit Deployments-Grenzen fuer vertragliche Fixierung, ohne Kundendaten im Modelltraining, mit industrieller Argumentation statt generischem Chat.

Nutzen Sie den Anhang, um diese Positionierung rechtlich und technisch gemeinsam zu pruefen.

## Abschluss

Nicht verhandelbare Anforderungen halten KI-Anbieter nach der Demo ehrlich. Schreiben Sie den Anhang einmal. Wiederverwenden Sie ihn ueber Kategorien mit Datenklassen-Overlays.

---

*Möchten Sie sehen, wie das in der Praxis funktioniert? [Sicherheit prüfen](https://dbr77.com/vector) oder [Demo buchen](https://dbr77.com/demo).*
