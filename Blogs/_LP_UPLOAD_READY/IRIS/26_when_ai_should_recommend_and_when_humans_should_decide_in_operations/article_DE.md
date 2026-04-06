# Wann KI empfehlen soll und wann Menschen im Betrieb entscheiden sollten

Target persona: Qualitaetsleitung / Betriebsleitung / Engineering Manager  
Funnel stage: Decision  
Core problem: Werke vertrauen Modellen zu stark oder verbannen KI komplett, weil eine einfache Entscheidungsrechte-Karte zu Risiko, Nachvollziehbarkeit und Verantwortung fehlt  
Main promise: ein klares Entscheidungsrechte-Framework mit Risikoklasse, Reversibilitaet und regulatorischer Exposition plus Umsetzung als Freigabe-Schwellen in Workflows

**Direkte Antwort:** KI soll bei operativen Entscheidungen mit mehrdeutigem Kontext, funktionsuebergreifenden Zielkonflikten oder Sicherheits- und Qualitaetsexposition standardmaessig empfehlen. Menschen sollten entscheiden, wenn die Aktion schwer rueckgaengig ist, regulatorische Dokumentation ausloest oder eine vereinbarte Risikoschwelle ueberschreitet, selbst wenn das Modell selbstsicher wirkt.

Das ist kein Misstrauen gegen KI.

Es ist die Zuordnung von Entscheidungsrechten zu Verantwortung in echten Werken.

## Die Fabrikregel: Empfehlung ist Default, nicht Ausnahme

In gesunden Industrieprogrammen verhaelt sich KI wie ein erfahrenes Stabsteam:

- es bereitet Optionen vor
- es hebt Randbedingungen hervor
- es zeigt Historie

Menschen behalten Autoritaet, wo die Organisation haftet.

## Ein praktisches Risikoklassen-Modell

Ordnen Sie jeden Entscheidungstyp einer Klasse zu. Bleiben Sie pragmatisch.

| Risikoklasse | Beispiele | typische KI-Rolle |
|---|---|---|
| Niedrig | Rauschen klassifizieren, interne Notizen entwerfen | frei unterstuetzen |
| Mittel | Prioritaetsband vorschlagen, Routing vorschlagen | empfehlen, Mensch bestaetigt |
| Hoch | Qualitaetsfreigabe, Absicht auf Verriegelungs-Umgehung | Mensch entscheidet, KI liefert Belege |
| Kritisch | Sicherheits-Override, Kundenversand-Freigabe | Mensch entscheidet mit formalem Record |

Das ist ein Framework, kein Rechtsdokument.

Ihr Compliance-Team sollte dennoch validieren.

## Nutzen Sie Reversibilitaet als zweite Achse

Selbst bei gleicher Risikoklasse zaehlt Reversibilitaet.

**Leicht rueckgaengig**  
Aufgabenreihenfolge aendern, nicht-kritische Arbeitspakete zuweisen, unverbindliche Planvorschlaege.

**Langsam oder teuer rueckgaengig**  
Schrott-Disposition, Kundenversand, grosse Geschwindigkeitsaenderungen, capex-ausloesende Aktionen.

Wenn Ruecknahme teuer ist, ziehen Sie menschliche Tore enger.

## Schwellen machen Philosophie zu Workflow

Machen Sie Regeln operativ:

- jeder Vorschlag ueber einem Schwere-Score braucht Supervisor-Bestaetigung
- jede Empfehlung, die ein geschuetztes Feld aendert, braucht rollenbasierte Freigabe
- jede Aktion an einem regulierten Objekt braucht einen auditierbaren Menschen-Schritt

Schwellen sollten fuer Bediener sichtbar sein, nicht im Modellcode versteckt.

## Uebergaben: wo Mischmodelle brechen

Mischmodelle brechen, wenn:

- KI in einem Tool empfiehlt
- Menschen in einem anderen entscheiden
- der Audit Trail split ist

Der Entscheidungsrecord sollte beim Arbeitspaket leben.

## Training: lehren Sie Ablehnung, nicht nur Zustimmung

Teams sollten ueben:

- gute Empfehlungen schnell anzunehmen
- Empfehlungen mit Reason Code abzulehnen
- zu eskalieren, wenn Kontext fehlt

Reason Codes sind, wie das Werk lernt.

## Warum IRIS Entscheidungsdisziplin unterstuetzt

DBR77 IRIS ist ein KI-natives Werksbetriebssystem mit vereinheitlichter Ausfuehrungsschicht fuer Produktion, Lager, Qualitaet, Instandhaltung und Aufgaben.

Vereinheitlichte Ausfuehrung macht Empfehlung, Freigabe und Audit Trail zu einer Geschichte statt zu drei Tools.

## Fazit

Die richtige Teilung ist nicht "KI versus Menschen".

Es ist "Empfehlung versus Entscheidung" gemappt auf Risiko, Reversibilitaet und Governance.

Machen Sie diese Zuordnung explizit, oder das Werk macht sie informell im Flur.
