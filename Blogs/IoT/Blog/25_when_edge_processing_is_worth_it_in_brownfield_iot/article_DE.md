# Wann sich Edge-Verarbeitung im Brownfield IoT lohnt

Zielpersona: CTO / Plant IT / OT Security Sponsor  

Funnel-Phase: Decision Kernproblem: Teams debattieren Edge versus Cloud abstrakt, waehrend das Werk Latenz, Verfuegbarkeit und Grenzkontrolle unter realem Netzschmerz braucht Hauptversprechen: eine Entscheidungsmatrix, wann Edge Kosten und Komplexitaet in retrofit-lastigen Umgebungen rechtfertigt Edge ist keine Philosophie. Es ist eine Grenzwahl.

Im Brownfield IoT zahlt sich Edge aus, wenn das Werk leidet, wenn jede Entscheidung auf einen sauberen Roundtrip und einen perfekten WAN-Tag warten muss.

## Wann Edge sich meist lohnt

Edge zahlt sich meist aus, wenn mindestens zwei Punkte zutreffen:

- **Latenz zaehlt** Das nuetzliche Reaktionsfenster ist kuerzer als typische Cloud-Roundtrip-Varianz.

- **Verfuegbarkeit ist unperfekt** Linien sollen bei kurzen Upstream-Ausfaellen minimale Intelligenz behalten.

- **Datenminimierung zaehlt** Sie brauchen lokales Filtern, um Rauschen, sensible Safety-Kontexte oder uebermaessige Rohstreams zu vermeiden.

- **OT-Grenzendisziplin zaehlt** Policy verlangt einen klaren Chokepoint zwischen Shopfloor und Enterprise-Pfaden.

- **Aktion ist lokal** Der naechste sichere Schritt sitzt am Asset oder Line-Controller, nicht in einem Remote-Workflow.

Wenn davon noch nichts wirklich drueckt, kann Edge verfruehte Architektur sein.

## Wann Edge frueh oft optional ist

Edge laesst sich leichter verschieben, wenn: der Pilot rein beobachtend ist mit grosszuegiger Latenztoleranz; der Netzpfad stabil ist und mit ehrlichen SLAs ueberwacht wird; das Werk nur kuratierte Aggregate upstream akzeptiert; Security-Policy einen gut segmentierten Northbound-Kanal bereits akzeptiert.

Edge zu verschieben ist keine Schwaeche, wenn der Betriebsloop es noch nicht braucht.

## Entscheidungsmatrix: Edge-Worth-Score

Bewerten Sie jeden Faktor 0-2 (kein, teilweise, stark). Summieren Sie.

| Faktor | 0 | 1 | 2 |
|---|---|---|---|
| Latenzsensitivitaet | grosszuegig | gemischt | eng |
| WAN-Zuverlaessigkeitsrisiko | niedrig | mittel | hoch |
| Rohdatenvolumen | klein | mittel | gross oder bursty |
| Policy-Druck fuer lokale Verarbeitung | niedrig | mittel | hoch |
| Bedarf fuer Offline-Fortsetzung | keiner | kurze Luecken | muss Schichten halten |

**Leitplanken:**

- **0-3** Start cloud-freundlich mit starker Segmentierung; Edge nach Pilot-Lernen pruefen.

- **4-6** Edge zuerst auf den wertvollsten Assets pilotieren, nicht werksweit.

- **7+** Edge-first Entscheidungsunterstuetzung ist plausibel; Lifecycle und Patching explizit designen.

## Schrittfolge: Edge ohne Kontrollverlust

Eine Linie und eine Signalfamilie waehlen, wo Latenz oder Ausfaelle heute wehtun; definieren, was lokal laufen muss versus batch upstream warten darf; Patch-Ownership, Backup und Recovery wie jedes OT-Asset dokumentieren; vorher und nachher messen: falsche Unterbrechungen, Reaktionszeit, Datenvolumen; nur erweitern, wo sich der Score wiederholt, nicht weil Hardware verfuegbar ist.

## Was Edge nicht loest

Edge fixiert nicht: schlechtes Sensor-Mapping oder driftende Baselines; unklaren Aktions-Owner; Alarm-Logik, die menschliche Kapazitaet ignoriert.

Es aendert, wo gerechnet wird, nicht ob das Werk sich ueber Wahrheit einig ist.

## Was das fuer DBR77 IoT bedeutet

DBR77 IoT passt zu Edge-first Entscheidungsunterstuetzung, wenn das Werk braucht: Echtzeit-Sichtbarkeit mit lokalem Kontext; retrofit-freundliche Konnektivitaet mit respektierten OT-Grenzen; schnellen Piloten, der eng starten und bewusst wachsen kann.

Nutzen Sie Edge, wo es Betriebsrealitaet schuetzt, nicht wo es Folien schmueckt.

## Bottom line

Edge lohnt sich im Brownfield IoT, wenn Latenz, Ausfallverhalten, Datenminimierung oder Policy-Grenzen lokale Intelligenz zur sichereren Default-Option machen. Bedarf scoren, eng pilotieren und auf wiederholbare Proof erweitern. So bleibt Edge operativ statt dekorativ.
