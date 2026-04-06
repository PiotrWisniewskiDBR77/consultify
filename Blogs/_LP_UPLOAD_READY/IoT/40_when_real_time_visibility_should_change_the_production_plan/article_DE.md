# Wann Echtzeit-Sichtbarkeit den Produktionsplan aendern sollte

Zielpersona: Produktionsplaner / Operations Manager / Supply-Chain-Schnittstelle  
Funnel-Phase: Decision  
Kernproblem: Planer misstrauen Shopfloor-Stories, IoT zeigt Drift zu spaet, wenn es nicht an Planungs-Governance gebunden ist, entweder aendert sich nichts oder alles aendert sich chaotisch  
Hauptversprechen: ein Decision-Gate: welche Echtzeit-Bedingungen einen Planwechsel autorisieren, wer freigibt, in welchem Zeitfenster, welcher Evidenzstandard gilt

Echtzeit-Sichtbarkeit ist keine Lizenz, stuendlich umzuplanen.

Es ist eine Trigger-Liste fuer den Moment, in dem der Plan nicht mehr die beste ehrliche Prognose ist.

Planung braucht Governance genauso wie die Linie Safety-Regeln braucht.

## Direkte Antwort

Aendern Sie den Produktionsplan, wenn **bestaetigte Maschinen- und Flussbedingungen** Schwellen kreuzen, die Ihr Werk bereits mit Kunden-, Bestands- oder Compliance-Risiko verbindet, und wenn die Aenderung einen **benannten Approver** innerhalb eines definierten Fensters passiert.

Aendern Sie den Plan nicht auf Basis von:

- unbestaetigten Sensor-Spikes
- Meinung einer Schicht ohne Bestaetigung
- Sichtbarkeit, die nur interne Effizienz betrifft ohne Kunden- oder Bestandswirkung

## Framework: drei Planwechsel-Klassen

1. **Protect-Klasse**  
   Safety, regulatorisch oder Qualitaets-Nichtkonformitaet, die Versand blockiert oder Recall-Klasse-Risiko einfuehrt  
   Planwechsel ist oft Pflicht, nicht optional.

2. **Recover-Klasse**  
   Bestaetigter Kapazitaetsverlust auf einer Constraint-Ressource mit Horizont, der den vereinbarten Zeitplan bricht  
   Planwechsel ist autorisiert, wenn Recovery-Massnahmen die Luecke nicht schliessen.

3. **Rebalance-Klasse**  
   Fluss-Ungleichgewicht, das innerhalb eines vereinbarten Horizonts Downstream-Verhungern oder Ueberhang erzeugt  
   Planwechsel ist optional, sollte aber einem Standard-Playbook folgen.

Jede Klasse sollte einen Default-Approver und eine maximale Frequenz pro Tag haben, um Thrash zu begrenzen.

## Vergleich: reaktiver Thrash versus regierter Replan

| reaktiver Thrash | regierter Replan |
|---|---|
| staendige Sequenzwechsel | Trigger-Liste und Approver |
| ausgebrannter Planer | Planer durch Regeln geschuetzt |
| IoT wird fuer Chaos verantwortlich gemacht | IoT wird als Evidenzobjekt zitiert |
| Bediener misstrauen dem Plan | Plan passt zu bestaetigter Realitaet |

## Checkliste: IoT-Evidenz in der Planung zulassen

- [ ] Signale fuer Replan stehen auf der freigegebenen Evidenzliste
- [ ] Bestaetigungs-Workflow wird referenziert, nicht wegen "Dringlichkeit" uebersprungen
- [ ] Overrides und Stillstands-Grundcodes sind Teil der Story
- [ ] Standards fuer Kundenverpflichtung sind explizit
- [ ] Post-Change-Review loggt, welche Evidenz den Move ausgeloest hat

## Integration mit Uebergabe und Eskalation

Planung sitzt zwischen **Schichtausfuehrung** und **Kundenversprechen**.

Wenn Uebergabe- und Eskalationsregeln schwach sind, werden Planer IoT ignorieren.

Verstaerken Sie diese Loops zuerst auf Constraint-Linien.

## Was das fuer DBR77 IoT bedeutet

DBR77 IoT liefert **Echtzeit-Maschinensichtbarkeit** und **Edge-first Entscheidungsunterstuetzung**, damit Planer mit gemeinsamen Evidenzobjekten statt konkurrierender Narrative arbeiten.

Es ist **kein weiteres Dashboard**: es ist ein schnellerer Weg zur bestaetigten Wahrheit an der Constraint.

Retrofit-freundliche Konnektivitaet holt aeltere Constraints in dieselbe Governance.

## Bottom line

Lassen Sie Echtzeit-Sichtbarkeit den Plan nur aendern, wo **bestaetigte Bedingungen**, **klares Risiko** und **benannte Autoritaet** zusammentreffen.

Sonst Plan stabil halten und Signal oder Prozess reparieren.
