# DnD-Map-Editor

Browserbasierter Editor für DnD-Karten mit Layern, eigenen Assets und gezeichneten Tiles. Kein Build-Schritt und keine Paketinstallation erforderlich.

- `index.html`: Map-Editor mit JSON-Import/-Export und PNG-Export.
- `asset-editor.html`: Assets erstellen und verwalten.
- `tile-drawer.html`: Eigene Tile-Texturen zeichnen.

Zum Ausprobieren `index.html` im Browser öffnen. Für das Laden von Repo-Assets aus `assets/index.json` das Projekt über einen lokalen HTTP-Server öffnen, beispielsweise mit der Live-Server-Erweiterung des Editors. Für gemeinsam genutzte Entwürfe alle drei Seiten unter derselben Browser-Adresse verwenden.

Maps und Asset-Entwürfe werden im Browserspeicher gesichert. JSON-Dateien zusätzlich als dauerhafte Sicherung exportieren; Browserdaten können gelöscht werden und der verfügbare Speicher ist begrenzt. Ein gültiger Map-Import lässt sich rückgängig machen. Ungültige Imports verändern die aktuelle Map nicht.

Die gezielten JavaScript-Regressionsprüfungen benötigen nur Node.js:

```sh
node tests/regressions.cjs
```

Sie prüfen unter anderem Importvalidierung, Undo/Redo, Entwürfe, Zoom, Radierer, Autosave und den PNG-Export mit simulierten Browser-Schnittstellen. Für eine visuelle Prüfung die drei Editoren im Browser öffnen.

Die Oberfläche verwendet lokal eingebundene [Violet Sans von Violet Office](https://github.com/violetoffice/violet_sans). Schriftdatei und SIL-OFL-Lizenz liegen in `assets/fonts/`. Das gemeinsame Layout bietet Material-Tabs mit Pfeiltastenbedienung, eine Bibliothekssuche und angepasste Ansichten für schmale Fenster.

`tests/ui-smoke.html` über denselben lokalen HTTP-Server öffnen, um Schriftladung, Editor-Start, Tabs, Tastaturbedienung, Suche und Layoutbreiten von 390, 900 und 1440 Pixeln im Browser zu prüfen. Die Prüfung lädt die Editoren und verwendet deren normalen Browserspeicher; dafür bei Bedarf ein separates Browserprofil nutzen.
