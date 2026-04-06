# Wie ein gutes Maschinenzustandsmodell vor dem IoT-Scale aussieht

Zielpersona: Fertigungsingenieur / OT-Systems Lead / Zuverlaessigkeitsingenieur  
Funnel-Phase: Evaluation  
Kernproblem: Teams skalieren Sensoren, bevor sie vereinbaren, was "gut laufen" in Maschinensprache heisst, jeder Standort erfindet unter Druck eigene Labels  
Hauptversprechen: ein minimales, regierbares Zustandsmodell: stabile Zustaende, erlaubte Uebergaenge, Evidenz je Uebergang und explizite Unbekannt-Zustaende

IoT ohne Zustandsmodell zu skalieren ist wie Werkserweiterung ohne Linienbalance.

Sie werden schneller und finden Konflikte spaeter.

Ein Zustandsmodell ist keine Vendor-Featureliste.

Es ist die werksinterne Vereinbarung, wie Maschinenrealitaet auf die naechste operative Entscheidung abbildet.

## Direkte Antwort

Ein gutes **Maschinenzustandsmodell** vor dem Scale hat:

- eine kleine Menge **benannter Zustaende**, die Bediener und Instandhaltung schon im Gespraech nutzen
- **klare Uebergaenge**, gekoppelt an Signale oder physische Checks, nicht an Bauchgefuehl
- **einen Owner pro Uebergang**, wenn der Zustand eine andere Folgeaktion impliziert
- einen **Unbekannt**-Eimer, der kurzzeitig erlaubt ist mit zeitgebundenem Follow-up

Wenn Sie es nicht auf eine Seite zeichnen koennen, ist es nicht scale-reif.

## Zustaende versus Tags

Tags sind freie Labels.

Zustaende sind operative Verpflichtungen.

| Tags | Zustaende |
|---|---|
| viele, ueberlappend | wenige, sich gegenseitig ausschliessend fuer einen Asset-Moment |
| spaeter nett fuer Analytics | treiben Playbooks jetzt |
| leicht in Software hinzuzufuegen | schwer ueber Schichten zu alignen |

Tags fuer Engineering-Tiefe behalten.

Zustaende langweilig genug fuer die Flaeche halten.

## Framework: Sechs-Zustaende-Starterset

Namen ans Werk anpassen, Logik behalten:

1. **Planmaessiger Lauf**  
   Innerhalb vereinbarter Varianzbaender fuer Zyklus, Qualitaetsproxies und Randbedingungen

2. **Eingeschraenkter Lauf**  
   Laeuft, aber limitiert durch Material, Werkzeug, Personal oder Upstream-Fluss

3. **Degradierend**  
   Trend weg von Baseline ohne noch Stop; Instandhaltungs-Prioritaet steigt

4. **Stopp bekannt**  
   Grundcode passt zu bekanntem Fehlerbild oder verifizierter Bedingung

5. **Stopp unbekannt**  
   Stopp ohne vertrauenswuerdigen Grund; Untersuchungszustand

6. **Ausser Betrieb**  
   Geplante Arbeit, Ruesten oder Lockout; kein Fehlerzustand

Dieses Set reicht, um IoT, CMMS und Schichtsprache zu alignen, bevor Sie Standorte multiplizieren.

## Checkliste: Modell vor Scale validieren

- [ ] Bediener koennen Zustaende ohne Handbuch zuweisen
- [ ] jeder Zustand mappt auf eine Default-Rolle: Bediener, Instandhaltung, Engineering
- [ ] Uebergaenge loggen, wer physische Realitaet bestaetigt hat, wenn Sensoren widersprechen
- [ ] Standards referenzieren fuer Safety- und Qualitaets-Gates zwischen Zustaenden
- [ ] unbekannte Stopps haben ein Maximalalter vor Eskalation

## Vergleich: Sensor-first Scale versus Zustand-first

| Sensor-first | Zustand-first |
|---|---|
| mehr Punkte, unklare Bedeutung | weniger Punkte, vereinbarte Bedeutung |
| Schwellwert-Debatten in jedem Meeting | einmal debattieren, dann regieren |
| Dashboard-Sprawl | gemeinsame Sprache fuer Planung |

## Wann es scheitert

**Scheitert**, wenn Fuehrung das Modell als IT-Dokument statt als lebenden Operationsvertrag behandelt.

**Scheitert**, wenn Vendor-Zustaende nicht zur Instandhaltungs-Triage am Asset passen.

## Was das fuer DBR77 IoT bedeutet

DBR77 IoT unterstuetzt **Echtzeit-Maschinensichtbarkeit** und **Edge-first Entscheidungsunterstuetzung**, damit Zustandsuebergaenge nah am Asset bewertet werden koennen.

Retrofit-freundliche Konnektivitaet hilft Brownfield-Maschinen in dasselbe Zustandsvokabular ohne Rip-and-Replace.

Schnelle Piloten haerten das Modell auf einer Linienklasse, bevor Sie ausrollen.

## Bottom line

Vereinbaren Sie das **Zustandsmodell, bevor Sie Sensoren multiplizieren**.

Kleine, langweilige, regierte Zustaende schlagen eine grosse Wolke cleverer Tags, denen niemand in der Nachtschicht vertraut.
