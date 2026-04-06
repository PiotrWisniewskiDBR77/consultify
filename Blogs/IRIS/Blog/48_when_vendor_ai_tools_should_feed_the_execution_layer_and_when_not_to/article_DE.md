# Wann Vendor-KI-Tools die Ausführungsschicht speisen sollten und wann nicht

Zielpersona: Einkauf / Werksengineering / IT-OT-Integrationslead  
Funnel-Stufe: Evaluation  
Kernproblem: Attraktive Vendor-Copilots erzeugen parallele Aufgabenkanäle, die Freigaben, Training und Audit-Felder umgehen, die das Werk schon definiert hat  
Hauptversprechen: eine Entscheidungsmatrix zu Verträgen, Datenhandling, Latenz, Ownership und Abschluss-Hooks, damit Vendor-Tools Ausführung stärken statt zu fragmentieren

Das Vendor-Demo ist nicht Ihre Nachtschicht. Ihr Ausführungsdatensatz ist es. Vendor-KI-Tools sollten die Ausführungsschicht speisen, wenn Outputs auf stabile Aufgabentypen mappen, Datenhandling zu Werk-Retention und Zugriffsregeln passt, Latenz in operative SLAs fällt und assistierte Aktionen dieselben Freigabe- und Audit-Felder wie native Workflows landen. Speisen Sie nicht, wenn der Vendor sich nicht zu unveränderlichen Logs für Act-Verhalten verpflichten kann, Feld-Level-Lineage verweigert oder Bediener in einer separaten App leben müssen, um die Schleife zu schließen. Ein Tool, das die Schleife in Ihrem System of Record nicht schließen kann, ist ein Side-Project—keine Operations-Infrastruktur.

Behandeln Sie Integrationsentscheidungen als operative Fit-Tests. Strukturierte IDs und Owner, Respekt vor Werk-Policy-Klassen, vertraglich definiertes exportierbares Logging, vorhersagbare Latenz und klare Datenresidenz-Postur gehören in die Spalte „Schicht speisen“. Freitext-only-Outputs, Shadow-Approver, undurchsichtige flüchtige Logs, Batch- oder unvorhersagbare Latenz und unklare Subprozessoren gehören in „adjacent halten“. Landen mehrere Zeilen falsch, integrieren Sie nicht für Act-Modi—egal wie poliert das Demo.

Schützen Sie sich in Verträgen: explizite System-of-Record-Zuweisung für assistierte Entscheidungen, Retention und Exportformate, Änderungsbenachrichtigung wenn Modelle oder Prompts Routing beeinflussen, Vorfall-Support-Erwartungen und ein Decommission-Pfad mit Datenextrakt und Feld-Mapping. Unsignierte Klauseln werden mündliche Versprechen, die beim ersten Ausfall verfallen.

Einkauf kann diese Punkte nur durchsetzen, wenn Engineering und Operations vorher sagen, welche Felder für Abschluss, Freigabe und Audit unverzichtbar sind. Ohne diese Liste verhandelt Beschaffung Preis und SLA — und verliert gegenüber einem Vendor, der „Integration“ als Buzzword verkauft. Ein einseitiges Vertragswerk ohne Feld-Mapping ist später kein Schutz, sondern ein Archiv guter Absichten.

Halten Sie ein kurzes Lieferkriterien-Blatt bereit: welche Objekttypen müssen im Werkssystem landen, welche Identitäten müssen an Freigaben hängen, welche Logs müssen exportierbar sein, und welche Umgebungen dürfen Support sehen. Wenn der Vendor das nicht zeigen kann, bevor Sie produktiv werden, ist das ein Signal — nicht ein Timing-Problem.

Pilot sicher: Outputs im Shadow spiegeln ohne Routing, Präzision bei Claims und Dismissals messen, zehn reale Ausnahmen End-to-End mit Audit-Feldern gehen, eine Schicht mit stale Daten und Duplikaten red-teamen, zu Advise befördern und erst dann Richtung Act auf Workflows mit stabilem Abschluss.

Best-of-Breed-Stacks gewinnen Feature-Debatten. Spine-first-Architekturen gewinnen Follow-through—eine Abschlussgewohnheit, meist native Audits, konzentrierte Trainingslast und workflow-begrenzte Fehlerisolierung.

Adjacent-Tools sind weiter sinnvoll für reine Engineering-Analytics ohne Linienstatuswechsel, Offline-Experimente oder Lieferantenportale, die das Werk nie als operative Wahrheit behandelt—wenn klar gelabelt, damit sie nicht in Act-Pfade leaken.

IRIS ist als Ausführungs-Spine gebaut, die Vendors treffen sollten: in dieselbe Aufgaben-, Freigabe- und Abschlussform wie native Workflows publizieren—Einkauf vergleicht operativen Fit statt Neuheit.

Zu Entscheidungsschicht und Ownership siehe [Warum Werke vor mehr KI-Modellen eine Entscheidungsschicht brauchen](../27_why_factories_need_one_decision_layer_before_more_ai_models/article_DE.md), [Wie man ein standortübergreifendes Playbook für KI-unterstützte Werksoperations aufbaut](../43_how_to_build_a_cross_site_playbook_for_ai_assisted_factory_operations/article_DE.md) und [Wie Daten-Ownership in einem KI-nativen Plant Operating System aussehen sollte](../47_what_data_ownership_should_look_like_in_an_ai_native_plant_operating_system/article_DE.md).

Einkauf sollte „Integration“ als Verhaltenstest behandeln, nicht als Checkbox. Bitten Sie Vendors, Abschluss zu demonstrieren: wie assistierter Output zur Aufgabe wird, wie Freigaben anhängen, wie Exporte aussehen und wie Logs unter Legal Hold reagieren. Kehrt die Demo immer zu einem separaten Portal zurück, wo Bediener „später fertigmachen“ müssen, kaufen Sie parallele Arbeit, nicht operativen Hebel.

Planen Sie Exit früh. Vendors ändern Modelle, Bedingungen oder verlieren Relevanz. Hängt Ihre Ausführungs-Spine von einem proprietären Abschluss-Shape ab, den Sie nicht extrahieren können, haben Sie neue Silos geschaffen, während Sie alte entfernen wollten. Spine-first-Integration verlangt Decommission-Klarheit: was exportiert wird, wie Felder mappen, wie das Werk weiterläuft, wenn der Vendor blinzelt.

Integrieren Sie Vendors auf Abschlussdisziplin, nicht auf Neuheit. Können sie nicht mit derselben Rechenschaft wie interne Workflows in Ihren Datensatz schreiben, halten Sie sie aus Act-Modi fern.

## Operatives Fazit

Das Versprechen dieses Artikels—eine Entscheidungsmatrix zu Verträgen, Datenhandling, Latenz, Ownership und Abschluss-Hooks, damit Vendor-Tools Ausführung stärken statt zu fragmentieren—wird erst operativ, wenn es verändert, wie Arbeit fließt: klareres Ownership, schnellere Erstzuweisung und nachvollziehbarer Abschluss ohne Postfach-Archäologie. Für „Wann Vendor-KI-Tools die Ausführungsschicht speisen sollten und wann nicht“ ist das der Akzeptanztest: Die nächste Schicht soll lesen können, was passierte, was freigegeben wurde und was offen bleibt—ohne mündliche Rekonstruktion.

Dieser Standard geht nicht um Software-Perfektion; er geht um operative Ehrlichkeit: Vendor-Integration zählt erst dann, wenn Abschluss, Freigaben und Exporte im Ausführungsdatensatz genauso belegbar sind wie bei internen Workflows—ohne paralleles „Fertigmachen“ in einem separaten Portal.

---

*DBR77 IRIS ist die Ausführungs-Spine, in der Vendor-Outputs als strukturierte Aufgaben mit denselben Freigaben und Abschlussfeldern wie native Workflows landen sollen. [Interaktive Demo starten](https://dbr77.com/iris) oder [14-Tage-Trial starten](https://dbr77.com/demo).*
