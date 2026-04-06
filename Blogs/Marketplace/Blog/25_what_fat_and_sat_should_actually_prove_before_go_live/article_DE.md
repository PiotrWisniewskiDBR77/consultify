# Was FAT und SAT vor dem Go-Live wirklich beweisen sollten

Zielpersona: Qualitäts- / Engineering-Manager (Eigentümer Herstellerseite)  
Funnel-Stufe: Übergang Entscheidung zu Lieferung (Absicherung vor Go-Live)  
Kernproblem: FAT und SAT driften zu zeremoniellen Walkthroughs, die Papier unterschreiben, aber operatives Risiko nicht reduzieren  
Hauptversprechen: Ein manufacturer-first Abnahmerahmen, der Evidenz daran bindet, was in der ersten echten Produktionswoche wahr sein muss

Factory Acceptance Testing und Site Acceptance Testing sind keine Moralevents. Sie sind Controls. Sie scheitern, wenn Teams sie als Demos mit Zeugen, Fotomotive oder Checkbox-Übungen behandeln, losgelöst von Produktionsrealität. Sie funktionieren, wenn sie eine Frage mit Evidenz beantworten: Was würde uns verweigern, dies in Produktion zu fahren, und wie testen wir dafür, bevor wir die Linie committen?

FAT soll zeigen, dass das integrierte System vertragsdefinierte Abnahmekriterien unter lieferantenkontrollierten Bedingungen erfüllt, mit nachverfolgbaren Records gebunden an Requirements – nicht „es hat sich bewegt“-Optimismus.

SAT soll zeigen, dass dieselben Kriterien in Ihrem Werk halten: echte Schnittstellen, echte Materialien wo anwendbar, echtes Guarding und Lockout/Tagout-Praxis und echtes operatives Ownership. Wenn FAT Bewegung beweist und SAT Hoffnung beweist, haben Sie Theater gekauft.

## Starten Sie mit Abnahmeobjekten, nicht Zeremonienterminen

Bevor Sie Räume und Flüge planen, listen Sie, was wahr sein muss: Sicherheitsfunktionen verhalten sich spezifiziert; Zyklus und Durchsatz liegen in einem vereinbarten Band unter einem definierten Lastmodell; Qualitätsoutputs erfüllen den Sampling-Plan; Fehlerbehandlung und Recovery funktionieren unter realistischen Faults; Daten- und MES-Handshakes übermitteln vereinbarte Messages; Dokumentation und Training lassen Operateure Standardarbeit fahren. Was nicht gelistet ist, wird nicht getestet – darüber wird später teurer gestritten.

## Was ein ernsthaftes FAT liefert

Sie sollten FAT mit nachverfolgbaren Testaufzeichnungen, gemappt auf Requirement-IDs, einer Punchlist mit Ownern und Daten vor Versand, expliziten Notizen, was simuliert versus real ausgeführt wurde, und eingefrorenen Identifikatoren für Software- und Firmware-Builds verlassen. Schwache FATs handeln mit subjektivem „sieht gut aus“, beweglichen Zielen („wir tunen vor Ort“) und stillen Substitutionen in Tooling, Teilen oder Builds. Hersteller sollten diese Mehrdeutigkeit ablehnen.

## Was ein ernsthaftes SAT liefert

SAT bestätigt werks-spezifische Annahmen, schließt Lücken mit einem begrenzten Stabilisierungsfenster und messbaren Exit-Kriterien und erzeugt eine Übergabe, die sagt, was Tag eins supported ist versus spätere Verbesserungsphase. Schwache SATs unterschreiben Abnahme, während Verriegelungen „temporär“ umgangen werden, Optimierung unendlich verschoben wird oder Training Produktionsdruck geopfert wird.

## Werkseitige Realität: „kleine Lücken“ sind nicht klein

Unter Müdigkeit und Zeitplandruck werden ungelöste Themen als Startup-Rauschen umbenannt. Wenn eine Lücke Sicherheit, Ownership, Wiederholbarkeit oder Recovery-Verhalten berührt, ist es kein Rauschen – es ist ungeschlossenes Risiko, das auf die erste echte Produktionswoche wartet.

## Ein Drei-Fragen-Gate (nutzen Sie bei FAT und SAT)

Bevor Sie einen Abnahmeschritt unterschreiben, fragen Sie: erfüllt er geschriebene Kriterien mit vereinbarter Evidenz; sind bekannte Lücken mit Ownern, Daten und expliziter Risikoakzeptanz wo nötig dokumentiert; kann Operations Standardarbeit ohne heroische Intervention ausführen? Wenn die dritte Antwort nein ist, ist Go-Live eine Wette, keine Entscheidung.

## Wann pausieren

Pausieren Sie, wenn Scope-Änderungen als lockere Tweaks ohne Change Control ankommen, Testmaterialien unrepräsentativ und undokumentiert sind, Site-Personal nicht zum Testplan passt oder interne Owner (Instandhaltung, IT, Qualität) fehlen, sodass Defekte kein Zuhause haben. Pausieren ist billiger als Nacharbeit auf einer laufenden Linie.

## Wie DBR77 Marketplace zurückbindet

Abnahmedisziplin sollte zurückverfolgen, was vor der Vergabe verglichen, vertraglich gefasst und versprochen wurde. Das hält FAT und SAT an Buying-Logik gebunden statt sie als losgelöste Rituale schweben zu lassen.

Kontinuität zwischen Vertrag und Ausführungsübergabe: [Was vor der Unterzeichnung eines Automatisierungsvertrags zu prüfen ist](../20_what_to_check_before_signing_an_automation_contract/article_DE.md) und [Wie eine saubere Übergabe von Auswahl zu Lieferung aussehen sollte](../30_what_a_clean_handoff_from_selection_to_delivery_should_look_like/article_DE.md).

## Abnahme als Vertrag mit dem Shopfloor

FAT und SAT sind, wo abstrakter Scope gelebte Realität wird. Operateure sollten die Tests als ihre Welt erkennen: echtes Guarding, echte Materialien wo anwendbar, echte Recovery-Szenarien, echte Datenpfade. Wenn Tests „nah genug“ sind, validieren Sie nicht Produktion – Sie validieren eine Story. Dieser Unterschied zeigt sich beim ersten Lauf unter Kundendruck.

Gute Abnahmedisziplin schützt auch Lieferanten, die korrekt gearbeitet haben. Wenn Kriterien explizit sind, können starke Performer Completion ohne endlose Meinungskämpfe belegen. Schwache Kriterien bestrafen alle, indem sie Completion in Verhandlung verwandeln.

## Fazit

FAT beweist integrierte Performance gegen Vertragskriterien mit Records. SAT beweist dasselbe in Ihrem Kontext mit operativem Ownership. Definieren Sie Abnahme früh – oder zahlen Sie für Mehrdeutigkeit in der ersten echten Produktionswoche.

---

*DBR77 Marketplace hilft Herstellern, Scope, Schnittstellen und Accountability früh sichtbar zu halten, damit Abnahmekriterien schwerer in die Go-Live-Woche verschoben werden können. [Beschreiben Sie Ihre Herausforderung](https://dbr77.com/marketplace) oder [Angebote vergleichen](https://dbr77.com/demo).*
