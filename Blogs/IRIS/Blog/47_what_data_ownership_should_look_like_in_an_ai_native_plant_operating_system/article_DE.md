# Wie Daten-Ownership in einem KI-nativen Plant Operating System aussehen sollte

Zielpersona: CIO / IT-OT-Architekt / Data-Governance-Lead  
Funnel-Stufe: Consideration  
Kernproblem: „Jeder besitzt Daten“ heißt meist, niemand repariert Definitionen, Refresh-Ausfälle oder Lineage-Lücken, wenn Modelle und Regeln sich multiplizieren  
Hauptversprechen: eine praktische Ownership-Map für Quellsysteme, kuratierte operative Definitionen, Assistance-Outputs und Audit-Trails mit explizitem RACI

„Jeder besitzt Daten“ heißt meist, niemand repariert es, wenn es unter Druck bricht. In einem KI-nativen Plant Operating System muss Ownership in Rollen geschrieben sein: ein rechenschaftspflichtiger Owner pro operativer Definitionsfamilie, ein verantwortlicher Steward für tägliche Qualität, konsultierte Parteien für konsumierende Workflows und explizite Regeln für Assistance-Outputs—die den Workflow erben, den sie berühren, nicht den Modell-Vendor. Refresh-SLAs, Stale-Feed-Ausnahmen und Versions-Publish-Rechte brauchen Namen. Können zwei Teams dieselbe Schwelle ohne Changelog-Eintrag editieren, haben Sie geteilte Schuld, keine Governance. KI schafft keine neuen Datenprobleme. Sie legen vernachlässigte Datenverträge offen.

Praktisch heißt das: Wenn eine KPI plötzlich „komisch“ wirkt, darf die Schicht nicht raten, ob das Modell spinnt oder die Definition driftet. Der Steward muss innerhalb klarer Frist sagen können, ob Feed, Mapping oder Semantik das Problem ist — und wer publiziert die Korrektur. Ohne diese Kette wird jedes Assistenz-Problem zur Modelldebatte, obwohl die Ursache oft ein Datenpfad ist, den niemand als sein eigenes Problem empfindet.

Denken Sie in Schichten. Quell-Feeds brauchen rechenschaftspflichtige Führung und verantwortliche Admins pro System—weil stiller Schema-Drift Vertrauen tötet. Operative Definitionen brauchen Funktions-Owner mit Analysten für tägliche Qualität—weil KPI-Streit oft Definitionskämpfe in analytischer Kleidung sind. Assistance-Konfiguration braucht Werksebene-Accountability mit einem funktionsübergreifenden Config-Team—weil Schatten-Schwellen-Edits Assistance zum Roulette machen.

Veröffentlichen Sie Definitionspakete, bevor Modelle darauf tunen: Klartext-Definitionen und Ausschlüsse, Feld-Mappings, Refresh-Takt und maximal akzeptabler Lag, bekannte Verzerrungen und Kompensationen sowie Änderungsfenster mit Bedienerkommunikation. Pakete verhindern „das Modell ist falsch“-Debatten, die eigentlich semantische Kriege sind.

Klären Sie, was das Werk besitzen muss versus was ein Vendor unter Vertrag führen darf. Schwellen, Freigabeklassen, Bedienernotizen und Claims gehören zum Werk. Modellgewichte und Prompts stehen unter Werkspolicy und Evaluation, Hosting-Details verhandelbar. Rohströme brauchen Zugriffs- und Retentionsregeln. Stille Verträge laden Worst-Case-Annahmen ein—fixen Sie sie explizit.

Machen Sie einen halbtägigen Ownership-Reset: Top-KPIs in assistierten Workflows listen, je einen rechenschaftspflichtigen Owner zuweisen (keine geteilten Titel), Feeds und Lag mappen, einen einzigen Publish-Pfad für Definitionsänderungen vereinbaren und monatliche Daten-Gesundheits-Reviews mit roten Flaggen und Aktionen planen.

RACI auf eine Seite zu bringen reicht nicht, wenn die „A“-Rolle im Alltag blockiert ist. Prüfen Sie deshalb auch Befugnis: darf der Owner wirklich publizieren, oder wird jede Änderung in endlosen Freigabeschleifen erstickt? Governance ohne Publish-Rechte ist Theater — und Assistance wird weiterhin im Schatten getunt, weil der offizielle Weg zu langsam ist.

Stale-Daten sind ein besonders häufiger Blindspot: der Feed läuft, aber mit Verzögerung oder Lücken, die im Dashboard noch „grün“ aussehen. Legen Sie für jede kritische Definition fest, welches Lag noch akzeptabel ist, wer bei Überschreitung alarmiert wird und ob Assistance automatisch zurückhaltender werden soll, bis der Feed gesund ist. Das ist kein Luxus; das ist, wie man verhindert, dass Software Vertrauen frisst, während die Datenbasis quietly stirbt.

Zentralisiertes IT-Ownership scheitert, wenn Operations bei einem Stopp nicht auf Tickets warten kann, wenn Definitionen wöchentliches Flächenurteil brauchen oder Instandhaltung und Qualität bei Labels uneins sind. Paaren Sie IT-Rechenschaft mit Funktions-Stewards, die die Ausnahmen leben.

IRIS macht Ownership sichtbar, wenn Definitionen, Aufgaben, Lineage und Assistance-Konfiguration in derselben Ausführungsschicht erscheinen—Publishes, Lag-Fixes und Break-Glass-Antworten haben Namen.

Zu operativer Datenreife und Vendor-Grenzen siehe [Warum KI ohne operative Daten in der Fertigung weiter scheitert](../32_why_ai_without_operational_data_still_fails_in_manufacturing/article_DE.md) und [Wann Vendor-KI-Tools die Ausführungsschicht speisen sollten und wann nicht](../48_when_vendor_ai_tools_should_feed_the_execution_layer_and_when_not_to/article_DE.md).

Ownership braucht auch Zähne in Operating Meetings. Ist Daten-Gesundheit ein Standing-Item mit roten Flaggen und Aktionen, werden Definitionen gefixt. Ist es Randthema, driften Definitionen bis Kunde oder Auditor eine Krise erzwingt. KI-native Operations machen diese Drift schneller teuer—Assistance wiederholt schlechte Definitionen in Maschinengeschwindigkeit. Das Werk fühlt das als „falsche KI“, während das Grundproblem vernachlässigtes Ownership ist.

Trennen Sie schließlich Config-Ownership von Modell-Ownership. Das Werk sollte Schwellen, Freigaben und operative Bedeutung besitzen. Vendors dürfen hosten, aber das Werk muss regieren, was „Assist“ ändern darf—und wer diese Änderungen publiziert. Ist Config-Ownership unscharf, wird jeder Vorfall zu einer Schuldzuweisungsspirale zwischen IT, Operations und Vendor.

Ownership ist wer publiziert, wer Lag fixt und wer Auditor:innen antwortet. Schreiben Sie es in RACI, nicht in Slogans.

## Operatives Fazit

Das Versprechen dieses Artikels—eine praktische Ownership-Map für Quellsysteme, kuratierte operative Definitionen, Assistance-Outputs und Audit-Trails mit explizitem RACI—wird erst operativ, wenn es verändert, wie Arbeit fließt: klareres Ownership, schnellere Erstzuweisung und nachvollziehbarer Abschluss ohne Postfach-Archäologie. Für „Wie Daten-Ownership in einem KI-nativen Plant Operating System aussehen sollte“ ist das der Akzeptanztest: Die nächste Schicht soll lesen können, was passierte, was freigegeben wurde und was offen bleibt—ohne mündliche Rekonstruktion.

Dieser Standard geht nicht um Software-Perfektion; er geht um operative Ehrlichkeit: Ownership zeigt sich in Publish-Pfaden, Log-Zugriff und RACI—nicht in Slogans, die beim ersten harten Audit in Rückfragen zerfallen.

---

*DBR77 IRIS vereinheitlicht Definitionen, Aufgaben und Assistance-Konfiguration in einer Ausführungsschicht, damit Ownership auf sichtbare Lineage und Publish-Pfade mappt. [Interaktive Demo starten](https://dbr77.com/iris) oder [14-Tage-Trial starten](https://dbr77.com/demo).*
