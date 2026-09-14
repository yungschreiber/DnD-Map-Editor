# DnD-Map-Editor

Browserbasierter Editor für DnD-Karten mit Layern, eigenen Assets und gezeichneten Tiles. Kein Build-Schritt und keine Paketinstallation erforderlich.

- `index.html`: Map-Editor mit Raumwerkzeug, Objektauswahl, Projektdateien und PNG-Export.
- `asset-editor.html`: Assets erstellen und verwalten.
- `tile-drawer.html`: Eigene Tile-Texturen zeichnen.

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
```

Sie prüfen Importvalidierung, Undo/Redo, Entwürfe, Zoom, durchgehende Pinselstriche, Räume, Objektauswahl, portable Projekte und PNG-Export mit simulierten Browser-Schnittstellen.

Die Oberfläche verwendet lokal eingebundene [Violet Sans von Violet Office](https://github.com/violetoffice/violet_sans). Schriftdatei und SIL-OFL-Lizenz liegen in `assets/fonts/`. Das gemeinsame Layout bietet Material-Tabs mit Pfeiltastenbedienung, eine Bibliothekssuche und angepasste Ansichten für schmale Fenster.

`tests/ui-smoke.html` über denselben lokalen HTTP-Server öffnen. Die Browserprüfung testet zusätzlich Raum- und Objektgesten, Projektimport mit eingebetteten Texturen, PNG-Auflösung und Transparenz sowie Layoutbreiten von 390, 900 und 1440 Pixeln. Sie erzeugt Testkarten und verändert Entwürfe; deshalb ein separates Browserprofil verwenden.
