# Wie man nicht verhandelbare KI-Anforderungen in die Enterprise-Beschaffung schreibt

Zielpersona: Beschaffungsleitung mit IT- und Legal-Partnern  
Funnel-Stufe: Decision  
Kernproblem: RFPs kopieren generische Sicherheitssprache, die Anbieter mit Checkbox-Antworten erfüllen können, während Training, Subprozessoren und Datenpfade undefiniert bleiben  
Hauptversprechen: Ein enger Requirements-Anhang macht Trainingsrichtlinie, Deployments-Grenzen, Audit-Rechte und Incident-Pflichten vor Unterschrift durchsetzbar

Beschaffung ist der Moment, in dem abstrakte Richtlinie zu Vertragswirklichkeit wird. Schwache Sprache erzeugt schwache Kontrollen — und schwache Kontrollen erscheinen später als hastige Legal-Arbeit, Notfall-Architektur-Patches und Programme, die nicht skalieren, weil niemand sagen kann, was wirklich live ist.

Schreiben Sie nicht verhandelbare KI-Anforderungen als nummerierten Anhang mit Zweckbindung der Datenverarbeitung, Verbot oder enger Erlaubnis für Training und menschliche Review, Subprozessoren und Änderungsankündigung, Deployments-Modus-Pflichten, Protokollierung und forensischer Kooperation, Haftungsausnahmen oder Ausnahmen passend zu Vertraulichkeitsverletzungen sowie Exit-Datenvernichtung mit Nachweis. Markieren Sie jede Klausel als bestanden oder nicht für die Vendor-Antwort, nicht als Erzählaufsatz. Wenn es nicht im Anhang steht, steht es nicht im Deal.

Engineering sollte den Anhang mitverfassen: Beschaffung allein kann keine sinnvollen Log-Mindestereignisse oder Promotions-Pfade schreiben, die zu Ihrer Architektur passen. Ohne technische Beteiligung wird der Anhang entweder zu generisch — oder zu spezifisch für ein Produkt, das Sie gar nicht einführen wollten.

## Zwölf Klauseln, die in den Anhang gehören

Zweckbindung: KI verarbeitet Kundendaten nur für benannte Dienste. Trainingsausschluss: Standard kein Training auf Kundeninhalten; jede Ausnahme braucht Opt-in-Umfang und Dauer. Fine-Tuning-Grenzen: falls erlaubt, verbotene Datenklassen für Tuning-Sets definieren. Menschliches Review: wenn Vendor-Personal Prompts oder Outputs sehen darf, Fälle, Regionen und Aufbewahrung festlegen. Subprozessoren: genehmigte Parteien listen oder Vorab-Genehmigung mit Mindestankündigungsfristen verlangen. Regionen: feste Allowlist für Speicher, Inferenz, Support-Zugriff und Backups. Deployments-Verpflichtung: On-Premise, Private API oder isolierter Tenant wie vertraglich vereinbart — nicht „beim Go-Live verfügbar, wenn wir neu verhandeln“. Security-Baseline: Ihr Enterprise-Control-Framework per Kennung referenzieren, nicht nur vages SOC-Wording. Protokollierung: Mindestereignisse, Aufbewahrung, Kundenzugriff und Exportformat. Vorfälle: Kategorien, Benachrichtigungsuhren, Root-Cause-Kooperation und regulatorische Unterstützung wo zutreffend. Audits: Frequenz, Umfang und Remediation-Fristen für kritische Findings. Exit: Datenrückgabe, Löschnachweise und Lösch-Erwartungen, wo Kundendaten persistieren könnte.

## Bewerten Sie Vendor-Antworten mit Evidence

Fordern Sie pro Klausel explizites Conform oder dokumentierte Ausnahme, Verweis auf technische Kontrolle oder Exhibit-Diagramm und benannte Subprozessoren wo relevant. Narrative Marketing-Anhänge zählen nicht.

Weiche Sprache — „Vendor wird angemessene Sicherheit wahren“ — scheitert im industriellen Einkauf, weil sie nicht testbar ist. Durchsetzbare Sprache bindet Pflichten an Exhibits, jährliche Nachweise und definierte Scopes. Weiche Claims, dass „Kundendaten geschützt sind“, scheitern, bis sie an konkrete Ausschlüsse für Trainings-Traffic gebunden sind. „Private Cloud verfügbar“ scheitert, bis Produktions-Inferenz auf die benannte Region, den Tenant und das Admin-Modell begrenzt ist, das Sie erwarten.

Gehen Sie, wenn der Vendor Trainingsausschlüsse für Ihre höchsten Datenklassen verweigert oder Subprozessoren sich über Nacht ohne durchsetzbare Remedy-Periode ändern können.

Zwölf-Klausel-Anhänge funktionieren, wenn jede Klausel ein technisches Gegenstück hat: eine Diagrammzeile, ein Log-Feld oder ein Test vor Unterschrift. Vector ist die Angebotsklasse, für die diese Klauseln geschrieben wurden: Deployments-Grenzen, die sich an Vertragssprache binden lassen, Ausschluss von Kundendaten aus dem Modelltraining und proprietäres industrielles Reasoning statt generischem Chat — damit Legal und Engineering dieselben Fakten unterschreiben.

Nicht verhandelbare Anforderungen sind, wie Hersteller KI-Anbieter nach dem Demo ehrlich halten. Schreiben Sie den Anhang einmal. Wiederverwenden Sie ihn über Kategorien mit Datenklassen-Overlays.

## Werks-Checkpoint

Behandeln Sie „Wie man nicht verhandelbare KI-Anforderungen in die Enterprise-Beschaffung schreibt“ als Entscheidungswerkzeug, nicht als Hintergrundlektüre. Fordern Sie vor dem nächsten Steuerungstreffen ein Artefakt ein, das Ihre Haltung belegt — Architekturdiagramm, Trainingsrichtlinien-Auszug, Log-Stichprobe, unterzeichnete Workflow-Klassifikation oder Promotions-Nachweis. Wenn der Raum nur Geschichten erzählen kann, tragen Sie noch Pilotenkleidung. Industrie-KI reift, wenn Evidence Routine wird: dieselbe Disziplin, die Sie bereits vor einem Linien-Release, einem Lieferantenwechsel oder einem großen IT-Cutover erwarten. Das ist der Shift von Begeisterung zu Infrastruktur — und er hält Programme über Audits, Fluktuation und Multi-Site-Ausbau kohärent.

Wenn die Führung eine knappe Entscheidungsgewohnheit will, nehmen Sie diese: Benennen Sie, was wahr sein muss, bevor sich die Nutzung ausweitet, und prüfen Sie in festem Rhythmus, ob es wahr ist. So wird Governance kein narrativer Komfort mehr, sondern eine Betriebsmetrik, die Ihre Werke ausführen können.

---

*DBR77 Vector passt zu Annex-Style-Prüfung durch klare Trainings-Haltung, Deployments-Grenzen und Industrie-KI-Positionierung für Enterprise-Sourcing-Teams. [Sicherheit prüfen](https://dbr77.com/vector) oder [Demo buchen](https://dbr77.com/demo).*
