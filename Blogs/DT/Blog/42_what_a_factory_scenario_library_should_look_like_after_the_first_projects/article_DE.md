# Wie eine Factory-Szenario-Bibliothek nach den ersten Projekten aussehen sollte

Target persona: Digital-Twin-Programmlead / industrieller Engineering-Manager, der Simulation ueber Piloten skaliert  
Funnel stage: Adoption  
Core problem: fruehe Erfolge leben in persoenlichen Ordnern, sodass der naechste Standort oder das naechste Projekt Discovery neu startet statt disziplinierte Szenariologik wiederzuverwenden  
Main promise: ein leichtes Bibliotheksmuster, das Einmallaeufe in eine wiederverwendbare Szenario-Testumgebung fuer Layout, Fluss und CAPEX verwandelt

nach den ersten Projekten sollte eine Factory-Szenario-Bibliothek einen benannten Basisfall, ein in jedem grossen Review genutztes Standard-Stresspaket, Szenario-Tags nach Entscheidungstyp (Kapazitaet, Intralogistik, Personal, Lieferant), eingefrorene Annahme-Snapshots mit Datum und eine kurze Nutzungsnotiz pro Szenario enthalten, die sagt, welche Frage sie beantwortet. Digital Twin ist kein 3D-Showcase; es ist ein Entscheidungssystem, das schneller wird, wenn Szenarien katalogisiert statt vergraben sind. Bibliotheken schlagen Hero-Dateien.

Sie machen den Zwilling fuer Finanzen und Operations lesbar, nicht nur fuer den Modellbauer.

## Was in Version eins der Bibliothek gehoert

Mindeststruktur: **Basisfall:** die vereinbarte Betriebsgeschichte fuer normale Planzyklen; **Peak und Erholung:** Nachfragespitzen plus die Ramp-Geschichte, die Sie wirklich glauben; **Grenzverschiebungs-Set:** Flaschenhalsverschiebungen, die Sie nach der naechsten Veraenderungswelle fuerchten; **Lieferanten- und Eingangsvarianten:** Vorlauf- und Losverhalten, das Sie schon gesehen haben; **Kill-Szenarien:** Geschichten, die schwache Layout-Optionen frueh disqualifizieren sollten.

Jeder Eintrag traegt: Owner, letztes Refresh-Ereignis und Link zu den Annahme-Ledger-Feldern, von denen er abhaengt.

## Taxonomie: Tags, die Uebergaben ueberleben

Einfaches Tag-Raster: `decision_type`: CAPEX, Footprint, Personal, saisonal, Stoerung; `horizon`: naechstes Quartal, naechste Rampe, naechstes Geschaeftsjahr; `evidence_grade`: verifiziert, illustrativ, Hypothese. Hypothesen-Szenarien sind erlaubt.

Sie muessen gekennzeichnet sein, damit sie nie als gepruefte Wahrheit auftreten.

## Checkliste: Bibliotheksgesundheit nach Projekt zwei oder drei

- [ ] jede grosse Freigabe referenzierte eine Szenario-ID, nicht nur einen Folientitel  
- [ ] das Standard-Stresspaket laeuft bei Strukturaenderung nach Ihrer Governance-Regel neu  
- [ ] neue Szenarien forken von einer datierten Basis statt still zu mutieren  
- [ ] Finanzen koennen die Bibliothek oeffnen und Bereiche sehen, nicht nur Punktoutputs  
- [ ] Operations weiss, welches Szenario welche wiederkehrende Meetingfrage beantwortet

## Vergleich: Ordnerchaos versus Bibliotheksdisziplin

| Muster | Ergebnis |
|---|---|
| Ad-hoc-Exporte per Mail | nicht nachverfolgbare Entscheidungen |
| Share ohne IDs | doppelte widerspruechliche Modelle |
| getaggte Bibliothek mit Snapshots | vergleichbare Vorher-Nachher-Reviews |
| Szenario an Gate-Memo gebunden | auditfreundliche Kapitalgeschichte |

## Was Digital Twin hier aendert

Digital Twin bleibt ein Szenario-Testumfeld, wenn die Bibliothek die Schnittstelle zu Entscheidungen ist.

## Was DBR77 Digital Twin ergaenzt

DBR77 Digital Twin unterstuetzt praxisnahen Szenariovergleich und einen Weg von manuellen Eingaben zu tieferer Integration, was eine disziplinierte Bibliothek ueber Projekte hinweg leichter haelt.

## Bottom line

Investieren Sie nach den ersten Siegen in Katalogisierung.

Die naechste Entscheidung soll sich wie Wiederverwendung mit Evidenz anfuehlen, nicht wie eine neue Science-Fair.

---

*Möchten Sie sehen, wie das in der Praxis funktioniert? [Demo buchen](https://dbr77.com/digital-twin) oder [Use Cases ansehen](https://dbr77.com/demo).*
