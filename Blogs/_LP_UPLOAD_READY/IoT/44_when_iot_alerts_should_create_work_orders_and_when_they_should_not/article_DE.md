# Wann IoT-Alarme Work Orders erzeugen sollten und wann nicht

Zielpersona: Instandhaltungsplaner / Zuverlaessigkeitsingenieur / CMMS-Owner mit Operations-Partnerschaft  
Funnel-Phase: Trial  
Kernproblem: CMMS wird mit Auto-Tickets ueberschwemmt die Techniker ignorieren, waehrend echte Ausfaelle weiter verbal eskalieren  
Hauptversprechen: eine Routing-Matrix: welche Alerts Work Orders werden, welche Watch-Items, welche nur bestehende Jobs anreichern

Ein Work Order ist ein Versprechen aus Arbeit und Teilen.

IoT-Alarme sind Beobachtungen.

Die beiden zu verwechseln verbrennt Vertrauen schneller als jede Dashboard-Farbe.

## Direkte Antwort

Erzeugen Sie ein Work Order aus einem IoT-Alarm nur wenn **Arbeit wirklich noetig ist**, **ein Jobplan oder Failure Mode existiert** und **das Signal mit Korrelation eine werksdefinierte Schwelle ueberschritten hat**.

Erzeugen Sie kein Work Order wenn der Alarm **Baseline-Rauschen** ist, **bekannter Transient beim Start**, **Training- oder Override-Situation** oder **besser zuerst als Supervisor-Eskalation**.

## Schrittfolge: Alarm zur Routing-Entscheidung

1. **Signal klassifizieren** gegen State Model und Signalwoerterbuch  
2. **Korrelation pruefen** zweites Signal, Wiederholung oder Bediener-Bestaetigung  
3. **Maintenance-Klasse zuordnen** aus Ihrer Prioritaetsleiter  
4. **Bei hohem Interrupt-Risiko** Interrupt-Pfad nach Werkregeln oeffnen  
5. **Wenn Lernen das Ziel ist** in Engineering-Sicht loggen ohne CMMS-Last  
6. **Woechentlich reviewen** False-Work-Order-Rate und Schwellen anpassen

## Vergleich: CMMS-Spam versus diszipliniertes Routing

| CMMS-Spam | Diszipliniertes Routing |
|---|---|
| jeder Schwellen-Trip wird Ticket | Tickets an Jobplaene gebunden |
| Techniker stummschalten | Alerts mappen auf Klassen |
| Planner wird Data-Janitor | Planner besitzt Routing-Regeln mit Ops |
| kein Feedback bei schlechten Regeln | gemessene False-Ticket-Rate |

## Eskalation ohne automatische Work Orders

Manche Zustaende brauchen **Supervisor-Sichtbarkeit** oder **strukturiertes Problemloesen** bevor jemand Schraubenschluessel-Zeit commitiert.

Das ist keine Schwaeche.

Das ist Respekt vor Brownfield-Constraints und endlicher Handwerkskapazitaet.

## Was das fuer DBR77 IoT bedeutet

DBR77 IoT ist **kein weiteres Dashboard**.

Es ist **Echtzeit-Maschinensichtbarkeit**, **retrofit-freundliche Konnektivitaet**, **schnelle Piloten** und **Edge-first Entscheidungsunterstuetzung**, die CMMS speisen kann wenn Routing-Regeln explizit sind, nicht wenn jedes Pixel schreit.

## Bottom line

Work Orders sollten selten und ernst sein.

IoT soll diese Disziplin sichtbar machen, nicht Chaos in den Backlog automatisieren.
