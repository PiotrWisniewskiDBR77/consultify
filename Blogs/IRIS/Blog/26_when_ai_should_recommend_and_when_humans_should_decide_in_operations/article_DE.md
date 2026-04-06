# Wann KI empfehlen soll und wann Menschen in Operations entscheiden sollten

Zielpersona: Qualitätsdirektor / Operationsdirektor / Engineering Manager  
Funnel-Stufe: Decision  
Kernproblem: Werke übervertrauen Modelle oder verbannen KI ganz, weil eine einfache Entscheidungsrechte-Karte zu Risiko, Nachverfolgbarkeit und Rechenschaft fehlt  
Hauptversprechen: Ein klares Entscheidungsrechte-Framework mit Risikoklasse, Reversibilität und regulatorischer Exposition plus Umsetzung als Freigabeschwellen in Workflows

KI sollte standardmäßig empfehlen, wenn Kontext mehrdeutig ist, Kompromisse Funktionen kreuzen oder Sicherheits- und Qualitätsexposition materiell ist. Menschen sollten entscheiden, wenn die Aktion schwer rückgängig zu machen ist, regulatorische Aufzeichnung auslöst oder eine vereinbarte Risikoschwelle überschreicht—selbst wenn das Modell selbstsicher wirkt. Das ist kein Misstrauen gegen KI. Es ist die Zuordnung von Entscheidungsrechten zu Rechenschaft in Umgebungen, in denen „schnell bewegen und entschuldigen“ kein akzeptables Prinzip ist.

In gesunden Industrieprogrammen verhält sich KI wie eine starke Stabsfunktion: sie bereitet Optionen vor, hebt Grenzen hervor, holt Historie. Menschen behalten Autorität, wo die Organisation haftet. Diese Teilung ist, wie Adoption ersten Kontakt mit Audits, Kunden und Nachtschichtdruck übersteht.

Stellen Sie sich eine typische Schichtsituation vor: Engpass an Station B, zwei mögliche Ursachen, begrenzte Zeit bis zum nächsten Kundenfenster. KI kann Prioritäten vorschlagen und frühere Muster anreichern — aber die Entscheidung, welche Hypothese zuerst verifiziert wird und welche Risiken dabei für Qualität oder Sicherheit akzeptiert werden, bleibt menschlich, weil hier Kompromisse zwischen Funktionen liegen, die kein Score allein tragen soll. Genau solche Szenarien gehören in Schulungen und Reviews, nicht nur abstrakte Policy-Sätze.

Risikoklasse ist eine plumpe, aber nützliche Linse. Niedriges Risiko—Rauschkategorisierung, Entwurfsnotizen—kann oft frei assistiert werden. Mittleres Risiko—vorgeschlagene Prioritätsbänder, Routing-Vorschläge—gehört typisch in Empfehlen-und-Bestätigen. Hohes Risiko—Freigaben, die kundenrelevanten Qualitätszustand ändern, Aktionen nahe Verriegelungsabsicht—braucht meist explizite menschliche Entscheidung mit Beleg. Kritische Aktionen—Sicherheits-Overrides, Kundenversand-Freigaben—sollten menschlich geführt mit formalen Aufzeichnungen bleiben, KI unterstützt Belege, besitzt nicht den Stempel.

Reversibilität schärft dasselbe Bild. Leicht reversible Schritte—nicht-kritische Aufgaben neu ordnen, Arbeitspakete neu zuweisen, die keine geschützten Zustände ändern—können schnellere Schleifen tolerieren. Langsame oder teure Rücknahmen—Scrap-Disposition, große Geschwindigkeitsänderungen, Aktionen mit Kapital- oder Kundenbindung—sollten menschliche Tore verschärfen, selbst wenn das Modell sicher klingt.

Philosophie wird erst operativ, wenn sie Schwellen wird. Veröffentlichen Sie Regeln, die Operatoren erkennen: Schwere-Scores, die Supervisor-Bestätigung erzwingen, geschützte Felder mit rollenbasierter Freigabe, regulierte Objekte mit auditierbaren menschlichen Schritten. Schwellen sollten auf der Fläche sichtbar sein—nicht im Modellcode versteckt, den niemand unter Druck erklären kann.

Gemischte Modelle brechen, wenn KI in einem Tool empfiehlt, Menschen in einem anderen entscheiden und der Audit-Pfad splitet. Der Entscheidungsdatensatz sollte beim Arbeitspaket leben, weil das Arbeitspaket ist, was das Werk morgen verteidigt.

Training sollte Ablehnung umfassen, nicht nur Annahme. Teams üben, gute Empfehlung schnell anzunehmen, mit Grundcode abzulehnen und zu eskalieren, wenn Kontext fehlt. Grundcodes sind, wie das Werk lernt, ohne Overrides in Scham oder unsichtbare Rebellion zu verwandeln.

Ohne Übung zur Ablehnung entsteht ein stiller Kompromiss: Menschen klicken zu, um Ruhe zu haben, oder sie umgehen das System komplett. Beides zerstört Datenqualität und Vertrauen. Machen Sie aus „ablehnen“ eine normale, dokumentierte Handlung — mit derselben Anerkennung wie einer schnellen Annahme, wenn die Empfehlung stimmte.

IRIS zählt, weil Empfehlung, Freigabe, Ablehnung und Audit-Pfad in einer reglementierten Workflow-Geschichte leben sollen. Das macht Entscheidungsrechte auf Operator-Tiefe prüfbar statt in Policy-Text zu zerfließen, dem niemand folgt, wenn die Linie heiß läuft.

Zum Agenten-Scope siehe [Was ein KI-Agent heute in einer Fabrik leisten kann](../22_what_an_ai_agent_can_do_in_a_factory_today/article_DE.md). Zu Vertrauenskriterien für Führung siehe [Was Fabrik-KI für Operations-Führungskräfte vertrauenswürdig macht](../29_what_makes_factory_ai_trustworthy_for_operations_leaders/article_DE.md).

Die richtige Teilung ist nicht „KI versus Menschen“. Es ist „Empfehlung versus Entscheidung“, gemappt auf Risiko, Reversibilität und Governance. Machen Sie diese Zuordnung explizit—oder das Werk macht sie informell im Flur, wo niemand das Ergebnis auditieren kann.

## Operatives Fazit

Das Versprechen dieses Artikels—klares Entscheidungsrechte-Framework plus Schwellen in Workflows—wird erst operativ, wenn es verändert, wie Arbeit fließt: klareres Ownership, schnellere erste Zuweisung und Abschluss, den Sie ohne Postfach-Archäologie nachverfolgen können. Für „Wann KI empfehlen soll und wann Menschen entscheiden sollten“ ist das der Akzeptanztest: die nächste Schicht sollte lesen können, was passiert ist, was freigegeben wurde und was offen bleibt—ohne sich auf mündliche Rekonstruktion zu verlassen.

Halten Sie Teams an einer einfachen Regel: Wenn sich eine Verbesserung nicht in Exporten aus dem Ausführungsdatensatz zeigen lässt, ist es noch keine operative Verbesserung—nur eine narrative. Diese Regel hält Programme ehrlich, wenn Demos gut aussehen, Übergaben aber fragil bleiben.

Wenn der Datensatz dünn ist, reparieren Sie den Datensatz, bevor Sie den Ehrgeiz erweitern.

---

*DBR77 IRIS hält Empfehlungen, menschliche Entscheidungen und Audit-Pfade an denselben Arbeitspaketen über Produktion, Lager, Qualität, Instandhaltung und Tasking. [Interaktive Demo starten](https://dbr77.com/iris) oder [Walkthrough ansehen](https://dbr77.com/demo).*
