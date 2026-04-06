# Wie Sie entscheiden welche IoT-Signale Edge-Logik verdienen

Zielpersona: IT-OT-Architekt / Leitung Steuerung / Werksystemingenieur  
Funnel-Phase: Consideration  
Kernproblem: Teams schieben entweder alles in die Cloud bequem oder sperren Logik in SPS ohne Sichtbarkeit, kein Pfad skaliert sauber im Brownfield  
Hauptversprechen: ein Entscheidungsraster: Latenz, Safety, Bandbreite, Autonomie bei Ausfaellen und Wartbarkeit bestimmen wo Logik lebt

Edge-Logik ist keine Ideologie.

Es ist eine Platzierungsentscheidung fuer Verantwortung und Uptime.

Falsche Platzierung zeigt sich als spaete Reaktion, fragile Overrides oder unauditierbare Aenderungen.

## Direkte Antwort

Legen Sie IoT-Logik an die Edge wenn **Subsekunden-Reaktion zaehlt**, **die Linie bei WAN-Beeintraechtigung sicher laufen muss**, **Rohstreams zu schwer fuer kontinuierlichen Versand sind** oder **lokale Verriegelungen deterministisches Verhalten** an Standards gebunden brauchen.

Halten Sie Logik zentral wenn **globale Optimierung**, **Cross-Linien-Korrelation** oder **seltene Batch-Analytik** das Ziel ist und Latenz akzeptabel ist.

Im Zweifel default **zuerst Sichtbarkeit**, dann Promotion nur fuer Signale die einen schriftlichen Edge-Promotion-Test bestehen.

## Framework: Edge-Promotion-Test (sechs Gates)

1. **Latenz-Gate**  
   Erzeugt Warten auf Cloud-Roundtrip Safety-, Qualitaets- oder Constraint-Risiko?

2. **Autonomie-Gate**  
   Braucht die Linie Entscheidungen bei Verlust des Uplinks?

3. **Bandbreiten-Gate**  
   Ueberlastet kontinuierlicher Cloud-Ingest das Werksnetz ohne Nutzen?

4. **Determinismus-Gate**  
   Erwartet ein Standard oder Versicherer begrenztes Verhalten?

5. **Wartbarkeits-Gate**  
   Kann Ihr Team Edge-Logik mit Change Control patchen und versionieren?

6. **Evidenz-Gate**  
   Laesst sich rekonstruieren was die Edge fuer Audits und Post-Incident-Review entschieden hat?

## Vergleich: Edge-by-default versus Cloud-by-default

| Edge-by-default | Cloud-by-default |
|---|---|
| viele kleine Regeln zu patchen | weniger Deploy-Targets |
| starke lokale Autonomie | einfachere globale Views |
| Risiko versteckten Logik-Drifts | Risiko spaeter Aktuierung |
| braucht diszipliniertes Versioning | braucht ehrliche Latenz-Rechnung |

## Signalqualitaet als Voraussetzung

Edge-Logik verstaerkt Fehler.

Promoten Sie Signale erst nach **ehrlicher Baseline** und **Definitions-Stabilitaet** ueber Schichten.

Sonst automatisieren Sie Verwirrung naeher an die Maschine.

## Was das fuer DBR77 IoT bedeutet

DBR77 IoT ist **kein weiteres Dashboard**.

Es ist **Echtzeit-Maschinensichtbarkeit**, **retrofit-freundliche Konnektivitaet**, **schnelle Piloten** und **Edge-first Entscheidungsunterstuetzung** sodass Logik-Platzierung zu Werks-Constraints passt statt zu Vendor-Defaults.

## Bottom line

Edge ist wo Dringlichkeit und Autonomie leben.

Cloud ist wo Muster und Portfolio-Sicht leben.

Waehlen Sie pro Signalklasse, nicht pro Slogan.
