# Warum KI ohne Betriebsdaten in der Fertigung weiter scheitert

Target persona: Werks-IT/OT-Leiter / Datenowner / Programmsponsor  
Funnel stage: Awareness  
Core problem: Teams liefern Modelle auf kuratierten Datensaetzen, waehrend das Werk noch mit partiellen Logs, spaeten Eintraegen und widerspruechlichen Definitionen laeuft, sodass Assistenz keine Schleifen schliesst  
Main promise: eine klare Checkliste, was Betriebsdaten fuer Werks-KI bedeuten, und warum Luecken Assistenten in teure Zusammenfasser verwandeln

KI ohne Betriebsdaten scheitert, weil Modelle dieselben Objekte brauchen wie die Flaeche: Auftraege, Routen, Aufgaben, Freigaben, Stillstandsgruende, Qualitaetssperren und Instandhaltungs-Arbeitspakete verknuepft mit Anlagen und Schichten. Wenn diese Datensaetze unvollstaendig, verzoegert oder funktionsweise unterschiedlich definiert sind, kann KI fliessenden Text erzeugen und trotzdem keine Reaktion, Ownership oder Follow-through treiben. Das ist kein "Data-Lake-Groesse"-Problem.

Das ist ein "kann das System einen glaubwuerdigen naechsten Schritt tasken"-Problem.

## Was "Betriebsdaten" im Werk bedeuten

Betriebsdaten sind alles, was ein Vorgesetzter fuer die naechsten zwei Stunden ohne Seitengespraech braucht.

Mindest-glaubwuerdig: Arbeitsidentitaet: welcher Auftrag, Charge oder Job ist aktiv; Status: laeuft, wartet, blockiert, gesperrt; Ownership: wer traegt gerade Verantwortung; Zeitstempel passend zur Schichtrealitaet, nicht nur ETL-Fenster; Grundcodes, die unter Druck wirklich gewaehlt werden; Abschlussnachweis: was aenderte sich, wer freigab, wann endete es.

Wenn Ihre KI diese Felder nicht benennen kann, ist sie nicht in Operations verankert. Sie ist in Folien verankert.

## Typisches Muster: saubere Historie, schmutzige Gegenwart

Werke trainieren oder prompten oft mit: Exporten des letzten Quartals; harmonisierten KPI-Tabellen; manuell gereinigten "goldenen Wochen". Und deployen in: partiellen Scans; fehlenden Stillstandsgruenden; Qualitaetsnotizen in persoenlichen Postfaechern. Das Modell wirkt in der Demo intelligent. Es bricht in Dienstagnacht.

## Checklist: operative Reife fuer KI-Assistenz

Nutzen Sie das als Gate vor Modell-Scope-Erweiterung.

1. koennen wir die Top-20 Betriebsobjekte (Auftrag, Anlage, Aufgabe, Sperre, Arbeitsauftrag) in einem Glossar benennen?  
2. erscheinen diese Objekte in einem System of Record fuer Ausfuehrung, nicht nur Reporting?  
3. ist Tasking bei Ausnahmen Pflicht, oder optional "wenn jemand daran denkt"?  
4. hinterlassen Freigaben einen Audit Trail mit Akteur und Zeit?  
5. koennen wir Reaktionszeit von Trigger bis zugewiesenem Owner messen?  
6. tragen Nacht- und Wochenendschichten dieselben Felder wie Tag?

Bei mehr als zwei "Nein": Datenregeln reparieren, bevor ein weiteres Modell gekauft wird.

## Vergleich: Reporting-Daten versus Ausfuehrungs-Daten

| Signal | Reporting-tauglich | Ausfuehrungs-tauglich |
|---|---|---|
| Stillstand | Monatsaggregation | ereignisbasiert mit Anlage und Aufgaben |
| Qualitaet | Defektzaehler | Sperren mit Dispositionspfad und Freigaben |
| Instandhaltung | Kostenstellen-Summen | Arbeitsauftraege mit Teilen, Arbeit, Abschluss |
| Lager | Bestandssnapshot | Bewegungen gekoppelt an Produktionssignale und Owner |

KI auf Reporting-Daten liefert Kommentar.

KI auf Ausfuehrungs-Daten kann geroutete Arbeit mit Accountability vorschlagen.

## Reality check: das Datenproblem zeigt sich meist in der aktuellen Schicht, nicht im letzten Quartal

Viele Programme wirken mit historischen Exporten gesund. Die Schwaeche erscheint im Live-Betrieb, wenn:

- sich der aktive Auftrag geaendert hat, das Modell aber noch den Kontext von gestern sieht
- Stillstandsgruende leer bleiben, weil die Schicht unter Druck steht
- eine Freigabe muendlich existiert, aber nicht in einem Record, den die naechste Schicht pruefen kann

Darum heisst "gut genug fuer Analytics" oft noch nicht "gut genug fuer Assistenz".

## Wann partielle Daten akzeptabel sind

Partielle Daten koennen fuer enge Beratungs-Scopes funktionieren: Triage wiederkehrender Fragen mit menschlicher Bestaetigung; Checklisten-Entwuerfe, bei denen jeder Schritt geprueft wird; Ranking-Vorschlaege, die nie auto-zuweisen. Der Fehlmodus ist, diese engen Scopes als "Werks-KI" zu verkaufen.

## Warum IRIS auf ausfuehrungsreife Datensaetze ausgelegt ist

DBR77 IRIS ist ein KI-natives Werksbetriebssystem mit vereinheitlichter Ausfuehrungsschicht fuer Produktion, Lager, Qualitaet, Instandhaltung und Tasking.

Wenn Arbeitspakete, Freigaben und Abschluesse in einer Schicht leben, hoeren Betriebsdaten auf, ein Analytics-Projekt zu sein, und werden zum taeglichen Rueckgrat der Assistenz.

## Fazit

Betriebs-KI braucht Betriebsobjekte, live Ownership und Abschlussdisziplin.

Ein Modell ohne dieses Rueckgrat wird ein schneller Schreibkraft fuer Verwirrung.

---

*Möchten Sie sehen, wie das in der Praxis funktioniert? [14-Tage-Trial starten](https://dbr77.com/iris) oder [Walkthrough ansehen](https://dbr77.com/demo).*
