# Was FAT und SAT vor Go-Live wirklich beweisen sollten

Target persona: Qualitaets- / Engineering-Manager (Hersteller-Owner)  
Funnel stage: Decision bis Delivery-Handoff (Assurance vor Go-Live)  
Core problem: FAT und SAT werden zu zeremoniellen Walkthroughs, die Papier unterschreiben, aber operatives Risiko nicht reduzieren  
Main promise: ein hersteller-first Akzeptanz-Framework, das Evidenz an das koppelt, was in der ersten echten Produktionswoche wahr sein muss

FAT und SAT sind keine Motivations-Events. Sie sind Risikokontrollen.

Sie scheitern, wenn Teams sie behandeln wie: eine Demo mit Zeugen; ein Fototermin; eine Checkbox aus einer Vorlage von 2014. Sie funktionieren, wenn sie eine Frage beantworten:

was wuerde uns verweigern, das in Produktion zu fahren, und wie testen wir das, bevor wir die Linie committen?

FAT soll beweisen, dass das integrierte System die vertragsdefinierten Akzeptanzkriterien unter lieferanten-kontrollierten Bedingungen mit nachvollziehbaren Records erfuellt.

SAT soll beweisen, dass dieselben Kriterien in Ihrem Werkskontext mit echten Schnittstellen, echten Materialien wo relevant und echter Operations-Ownership gelten.

Wenn FAT "es bewegt sich" beweist und SAT "wir hoffen," haben Sie Theater gekauft.

## Akzeptanzobjekte definieren, bevor Sie Termine planen

Starten Sie mit Objekten, nicht mit Zeremonien. Mindest-Akzeptanzobjekte (an Kategorie anpassen):

| Objekt | FAT-Intent | SAT-Intent |
| --- | --- | --- |
| Safety-Funktionen | Verhalten beim Lieferanten verifiziert | Verhalten mit Werks-Guarding und LOTO-Realitaet |
| Takt und Durchsatzband | unter vereinbartem Lastmodell demonstriert | mit Werks-Zufuehrungs-Constraints demonstriert |
| Qualitaetsoutputs | gegen Sampling-Plan gemessen | gegen Werks-Metrologie und Normen gemessen |
| Fehlerhandling und Recovery | scriptete Fault-Cases bestehen | operator-realistische Faults bestehen |
| Daten und MES-Handshake | Schnittstellen bestehen vereinbarte Testmessages | Schnittstellen bestehen unter Werksnetzbedingungen |
| Dokumentation und Training | O&M-Paket-Vollstaendigkeit | Operatoren koennen Standard Work ausfuehren |

Wenn ein Objekt nicht gelistet ist, wird es nicht getestet. Es wird spaeter teurer debattiert.

## FAT: was "pass" bedeuten soll

Ein nuetzliches FAT liefert: Punch-List mit Ownern und Terminen vor Versand; traceable Testrecords mit Requirement-IDs; explizite Exclusions (simuliert versus real).

Ein schwaches FAT liefert: subjektive Meinungen ("sieht gut aus"); bewegliche Ziele ("wir tunen vor Ort"); versteckte Substitutionen (anderes Tooling, andere SKU, anderer Software-Build).

Hersteller sollten eingefrorene Build-IDs fuer Software und Firmware am FAT bestehen.

## SAT: was "pass" bedeuten soll

Ein nuetzlicher SAT liefert: Bestaetigung, dass werks-spezifische Annahmen gehalten haben; ein begrenztes Stabilisierungsfenster mit messbaren Exit-Kriterien; eine signierte Uebergabe, was ab Tag eins supported ist versus Phase-zwei-Verbesserung.

Ein schwacher SAT liefert: "wir optimieren nach Start"; Abnahme unterschrieben waehrend Interlocks "temporaer" umgangen werden; Training verschoben, weil Produktionsdruck gewinnt.

## Reality check: Abnahme bricht meist dort, wo das Werk offene Punkte als beherrschbares Anlaufrauschen behandelt

Genau deshalb koennen schwache SATs sich operativ noch normal anfuehlen. Die Leute sind muede. Die Linie ist fast bereit. Der fehlende Punkt klingt klein. Aber wenn eine bekannte Luecke Safety, Ownership, Wiederholbarkeit oder Recovery-Verhalten betrifft, ist sie kein Anlaufrauschen.

Sie ist ungeschlossener Risk, der auf die erste echte Produktionswoche wartet.

## Ein einfaches Pass-Fail-Gate (drei Fragen)

Nutzen Sie dieselben drei Fragen bei FAT und SAT:

1. Erfuellt es die geschriebenen Akzeptanzkriterien mit vereinbarter Evidenz?
2. Sind bekannte Luecken dokumentiert mit Ownern, Daten und Risikoakzeptanz wo noetig?
3. Koennen Operations Standard Work ohne heroische Intervention fahren?

Wenn Frage drei "nein" ist, ist Go-Live eine Wette, keine Entscheidung.

## Wann FAT oder SAT pausieren

Pausieren Sie, wenn: Scope-Aenderungen als "kleine Tweaks" ohne Change Control kommen; Testmaterial nicht repraesentativ ist und niemand die Substitution dokumentiert; Integrator-Besetzung vor Ort nicht zum Plan passt und kritische Tests ausfallen; interne Owner fehlen (Maintenance, IT, Quality) und Defekte verwaist sind. Pausieren ist kein Drama. Es ist guenstiger als Rework auf einer live Linie.

## Was das fuer DBR77 Marketplace bedeutet

DBR77 Marketplace soll Automatisierungseinkauf inspizierbar machen: klarere Angebote, klarerer Vergleich, klarere Accountability.

Akzeptanzdisziplin ist der Moment, in dem klare Angebote klare Realitaet werden.

Wenn kommerzielle Modelle und Scope frueh vergleichbar sind, sind Akzeptanzkriterien schwerer in Fussnoten zu verstecken. Marketplace ist kein Roboterkatalog.

Es ist Workflow und Vertrauensschicht, die Herstellerentscheidungen durch Auswahl, Vergleich und Lieferrealitaet unterstuetzt.

## Fazit

FAT beweist das integrierte System gegen Vertragskriterien mit nachvollziehbaren Records.

SAT beweist dieselben Kriterien in Ihrem Werkskontext mit Operations-Ownership.

Wenn Akzeptanz spaet definiert wird, zahlen Sie fuer Mehrdeutigkeit in der ersten Produktionswoche.

---

*Möchten Sie sehen, wie das in der Praxis funktioniert? [Ihre Herausforderung beschreiben](https://dbr77.com/marketplace) oder [Angebote vergleichen](https://dbr77.com/demo).*
