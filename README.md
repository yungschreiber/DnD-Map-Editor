# DnD-Map-Editor

Browserbasierter Editor für DnD-Karten mit Layern, eigenen Assets und gezeichneten Tiles. Kein Build-Schritt und keine Paketinstallation erforderlich.

- `index.html`: Map-Editor mit Raumwerkzeug, Objektauswahl, Projektdateien und PNG-Export.
- `asset-editor.html`: Assets erstellen und verwalten.
- `tile-drawer.html`: Eigene Tile-Texturen zeichnen.
- `procedural.html`: Isometrische Landschaften im Pixelstil aus einem Seed erzeugen.

Der Reiter **Procedural** öffnet einen eigenständigen Landschaftsgenerator. Wasserstand, Höhenwirkung und Walddichte einstellen und **Generieren** drücken; **Neue Landschaft** würfelt einen neuen Seed. Gleicher Seed und gleiche Einstellungen erzeugen in derselben Generatorversion dieselbe Insel. Der Generator läuft lokal im Browser, auch beim direkten Öffnen der HTML-Datei. Eine Übernahme in den Map-Editor ist noch nicht enthalten.

Rechts liegen die Werkzeuge **Höhe**, **Wald** und **Wasser** mit Icons. Die Auswahl zeigt darunter die zugehörigen Regler; ein erneuter Klick auf das aktive Malwerkzeug schaltet den Pinsel aus. **Wald** malt Tannen auf geeignetes Land. Pinselgröße und Dichte sind separat einstellbar: 100 % setzt einen dichten Wald, 0 % entfernt Bäume im übermalten Bereich, auch automatisch erzeugte. Wiederholtes Malen mit derselben Dichte verändert den Wald nicht weiter. Waldstriche verändern keine Geländehöhen und unterstützen Rückgängig/Wiederholen sowie die automatische Speicherung. **Wasser** hat vorerst nur eine vorbereitete Oberfläche mit deaktivierten Reglern.

Mit **Leere Wasserfläche** auf offenem Meer starten. **Berghöhe** aktiviert einen weichen Höhenpinsel: linke Maustaste gedrückt halten und langsam ziehen. Das Gelände wächst nach verstrichener Zeit; schnelle Mausmeldungen erzeugen keinen zusätzlichen Höhenschub. **Tempo** startet bei sanften 20 % und lässt sich auf 1 % reduzieren. Der Meeresboden steigt kontinuierlich an; oberhalb der Küste wächst das Gelände langsamer.

**Flachland**, **Hügel** und **Berge** wählen Höhenlimits von +4, +18 und +50 Prozentpunkten über dem Wasserstand. Das Limit lässt sich auch frei einstellen. Wiederholtes Übermalen füllt niedrige Stellen bis zum Limit auf, ohne darüber hinauszuwachsen; bereits höhere Berge werden nicht abgesenkt. Flachland ist die Voreinstellung. Mit großem Pinsel Flächen aufbauen, für Bergketten ein höheres Limit und einen kleineren Pinsel wählen.

Die rechte Maustaste verschiebt die Ansicht; bei ausgeschaltetem Pinsel geht das auch mit links. **Q / E gedrückt halten** dreht die Kamera stufenlos mit etwa 60° pro Sekunde; Loslassen stoppt sofort. Die Geschwindigkeit hängt nicht von der Tastaturwiederholung ab. Beide Tasten gleichzeitig pausieren die Drehung; Fensterwechsel oder Fokus in einem Eingabefeld stoppen sie ebenfalls. Die Drehbuttons bewegen die Kamera weiterhin um jeweils 15°. **Mittlere Maustaste halten und nach oben/unten ziehen** neigt die Kamera zwischen flacher Ansicht (10°) und Draufsicht (90°). **Strg/Cmd + Mausrad** zoomt zwischen 25 und 400 % um die Stelle unter dem Mauszeiger. Die Auswahlfelder bieten dieselben Blickwinkel und Zoomstufen; **Standardansicht** stellt Drehung, Neigung und Zoom zurück, behält aber den Kartenausschnitt als Mittelpunkt. Beim Schreiben in Eingabefelder bleiben Q und E normale Buchstaben. Kameraänderungen beenden einen laufenden Pinselstrich, bevor sich die Ansicht verändert.

Wasser und bearbeitbares Gelände reichen über die ursprüngliche Insel hinaus. Gelände wird nur für generierte oder bearbeitete Bereiche gespeichert; die Welt ist praktisch erweiterbar, aber durch Speicher und Rechenleistung begrenzt.

**Rückgängig / Wiederholen** oder **Strg/Cmd + Z / Umschalt + Z** arbeiten pro Pinselstrich, auch nach einer Neugenerierung. Einstellungen, gezeichnete Höhen sowie Kameraposition, Drehung, Neigung und Zoom werden separat im Browser gesichert und beim Öffnen wiederhergestellt. **PNG exportieren** speichert den aktuellen Ausschnitt einschließlich Wasser, ohne Pinselmarkierung. Die Auflösung passt sich an das Seitenverhältnis der Ansicht an (768 Pixel Breite). Der Zoom verändert die Kamera, nicht die Bildauflösung.

Zum Ausprobieren `index.html` im Browser öffnen. Für das Laden von Repo-Assets aus `assets/index.json` das Projekt über einen lokalen HTTP-Server öffnen, beispielsweise mit der Live-Server-Erweiterung des Editors. Für gemeinsam genutzte Entwürfe alle drei Seiten unter derselben Browser-Adresse verwenden.

Zwölf eingebaute Startassets stehen auch beim direkten Öffnen der HTML-Datei bereit: Tavernentisch, Bank, Bett, Bücherregal, Kiste, Teppich, Altar, Sarkophag, Eiche, Felsen, Lagerfeuer und Brunnen. Im Asset-Editor lassen sie sich als eigene Kopie bearbeiten; die Vorlagen bleiben erhalten. Sechs neue Materialien stehen unter **STUDIO** zur Verfügung: Pflaster, Moosstein, dunkle Dielen, Marmor, Teppich und Flachwasser. Die Assets und SVG-Texturen wurden für dieses Projekt erstellt.

Mit **9 / Raum** ein Rechteck von mindestens 3 × 3 Zellen ziehen. Boden und Außenwände werden in einem rückgängig machbaren Schritt auf dem aktiven Layer gezeichnet. Anschließend Türen mit einem passenden Tile in die Wand setzen.

Mit **8 / Auswahl** ein platziertes Asset anklicken und ziehen. **Q / E** dreht es, **Strg/Cmd + D** dupliziert es, **Entf** löscht es. Die Auswahl berücksichtigt sichtbare Layer und transparente Asset-Zellen. **7** verschiebt weiterhin den gesamten aktiven Layer.

**Projekt speichern** oder **Strg/Cmd + S** erzeugt eine JSON-Projektdatei (Version 4) mit allen Layern, platzierten Assets und den verwendeten Tile-Definitionen samt eingebetteten Texturen. Importierte Tiles gelten nur für die geladene Map und überschreiben die eigene Tile-Bibliothek nicht. Ältere Map-Dateien lassen sich weiterhin importieren. Nicht platzierte Assets und nicht verwendete Tiles gehören weiterhin zur separaten Bibliothek.

Beim PNG-Export lassen sich Raster, Transparenz und 12–128 Pixel pro Feld wählen. Exportiert werden die sichtbaren Layer ohne Werkzeugvorschau oder Auswahlrahmen. Die gewählte Editor-Ansicht bleibt erhalten. Das Limit liegt bei 8192 Pixeln pro Seite und 32 Megapixeln insgesamt; größere Exporte benötigen eine kleinere Feldauflösung.

Maps und Asset-Entwürfe werden im Browserspeicher gesichert. JSON-Dateien zusätzlich als dauerhafte Sicherung exportieren; Browserdaten können gelöscht werden und der verfügbare Speicher ist begrenzt. Ein gültiger Map-Import lässt sich rückgängig machen. Ungültige Imports verändern die aktuelle Map nicht.

Die gezielten JavaScript-Regressionsprüfungen benötigen nur Node.js:

```sh
node tests/regressions.cjs
node tests/procedural.cjs
```

Sie prüfen Importvalidierung, Undo/Redo, Entwürfe, Zoom, durchgehende Pinselstriche, Räume, Objektauswahl, portable Projekte und PNG-Export mit simulierten Browser-Schnittstellen.

Die Procedural-Prüfung testet reproduzierbare Landschaften, Küsten, Höhenpinsel, zusammenhängende Striche, Speicherung und die Auswahl sichtbarer Geländepunkte. `tests/procedural-smoke.html` prüft im Browser zusätzlich Bildpixel, PNG-Export, Halten/Ziehen/Abbrechen, Rückgängig/Wiederholen, Verschieben und Zeichnen im entfernten Wasser, Wiederherstellung gezeichneter Höhen sowie Layoutbreiten von 390, 900 und 1440 Pixeln. Dafür ebenfalls ein separates Browserprofil verwenden.

Die Oberfläche verwendet lokal eingebundene [Violet Sans von Violet Office](https://github.com/violetoffice/violet_sans). Schriftdatei und SIL-OFL-Lizenz liegen in `assets/fonts/`. Das gemeinsame Layout bietet Material-Tabs mit Pfeiltastenbedienung, eine Bibliothekssuche und angepasste Ansichten für schmale Fenster.

`tests/ui-smoke.html` über denselben lokalen HTTP-Server öffnen. Die Browserprüfung testet zusätzlich Raum- und Objektgesten, Projektimport mit eingebetteten Texturen, PNG-Auflösung und Transparenz sowie Layoutbreiten von 390, 900 und 1440 Pixeln. Sie erzeugt Testkarten und verändert Entwürfe; deshalb ein separates Browserprofil verwenden.
