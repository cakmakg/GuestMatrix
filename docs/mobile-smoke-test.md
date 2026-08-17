# Mobiler Smoke-Test — Gäste-Ablauf und Betreiber-Panel (echtes Gerät)

Verifiziert die mobilen Oberflächen auf **echten Mobilgeräten** (nicht Emulator, nicht nur
DevTools), weil iOS Safari / Android Chrome Eigenheiten haben, die Desktop nicht zeigt
(Kamera-Dialog, HEIC-Fotos, `.mov`-Videos, Tastatur/Viewport, mitwandernde Adressleiste). Deckt
**NFR-04.1/.2/.3** und **NFR-01.1** (`docs/30-requirements.md`) ab.

Zwei Teile, beide manuell und zum Abhaken:

- **Teil A — Gäste-Ablauf** (`/e/<eventId>`): die Seite hinter dem QR, in allen drei Flow-Modi.
- **Teil B — Betreiber-Panel** (`/dashboard`): seit dem mobilen Umbau eine eigene Oberfläche mit
  unterer Leiste, Schublade und klebender Tabellenkopfzeile. Sie war **nie** an einem Gerät.

**Kein Vercel/Deploy nötig** — der lokale Dev-Server wird im selben WLAN vom Telefon erreichbar
gemacht.

## Code-Bereitschaft (vorab statisch geprüft — 2026-07-31)

- **Viewport:** In `app/layout.tsx` nicht explizit gesetzt, aber Next.js (App Router) injiziert den
  Default `<meta name="viewport" content="width=device-width, initial-scale=1">` — im gerenderten
  HTML bestätigt vorhanden. Damit greift das 360–428-px-Layout überhaupt.
- **Datei-Input:** In `GalleryFlow.tsx` / `FeedbackFlow.tsx` / `GuestbookFlow.tsx` gilt
  `accept="image/jpeg,image/png,video/mp4,video/quicktime"` → **`.mov` (`video/quicktime`)
  enthalten**. Serverseitig deckt `ALLOWED_MIME_TYPES` + Magic-Byte-Prüfung (confirm) dieselben vier
  Typen; Limit **50 MB**.
- **Kein `capture`-Attribut** → iOS/Android öffnen den **nativen Auswahldialog** (Kamera **oder**
  Mediathek **oder** Dateien) statt die Kamera zu erzwingen — passend für UGC.
- **Bekannter Prüfpunkt iOS HEIC:** iPhone-Fotos sind standardmäßig HEIC; `accept` listet HEIC
  **nicht**. Safari transcodiert HEIC beim Upload i. d. R. zu JPEG — **muss am echten Gerät bestätigt
  werden** (Schritt 3b). Schlägt es fehl, ist das eine echte Lücke (accept/Server um HEIC erweitern).

### Nachtrag 2026-08-17 — was sich seit der ersten Fassung geändert hat

Der Stand dieser Liste, ehrlich: die Punkte unten sind statisch geprüft und im Browser bei
360/390px gemessen. Ein **erster Lauf am echten Gerät fand am 2026-08-17 statt** — er hat zwei
Befunde erbracht (beide behoben, siehe unten) und lief danach durch; die vollständige Matrix ist
damit **nicht** abgehakt, sondern erst begonnen.

**Befunde des ersten Geräte-Laufs (2026-08-17, beide behoben):**

1. **Der Gästelink/QR zeigte auf `localhost`** und war vom Telefon aus tot. Ursache war keine
   Testkonfiguration, sondern die Herkunft der Adresse: sie kam aus `NEXT_PUBLIC_APP_URL` statt aus
   dem Request. Behoben in `lib/app-url.ts` — die Adresse ist jetzt die, unter der das Dashboard
   gerade läuft. Der Vorbereitungspunkt 6 unten ist damit **hinfällig** (er bleibt als Erklärung
   stehen, falls jemand eine alte Fassung testet).
2. **„Gästelink kopieren" behauptete Erfolg, ohne zu kopieren.** Ohne HTTPS fehlt
   `navigator.clipboard`; der Rückfall `execCommand` meldet auf iOS Safari `true`, legt aber nichts
   in die Zwischenablage. Der Knopf zeigt jetzt in diesem Fall den Link zum Auswählen und ein
   „Öffnen" statt eine Erfolgsmeldung.

Weiterhin nur gemessen, nicht am Gerät durchgespielt:

- **Gäste-Flow trägt jetzt die Themen-Tokens** (`resolveGuestTheme`): cremefarbener Grund, weiße
  Karte, Serifen-Überschrift, Pillen-Knöpfe. Vorher stand er im alten Satz (roter Kopfbalken,
  Nullrundung). Ein Gästebuch-Gast sieht `album`, ein Hotel-/Agentur-Gast `operator` — der
  Unterschied ist nur Dichte, die Sprache ist dieselbe.
- **Sterne sind Grafiken mit 44px Trefferfläche** (vorher Textglyphen, die Zusatzfragen mit ~24px).
- **Dateiauswahl ist ein `<label>`** mit unsichtbarem, aber fokussierbarem Feld (vorher ein `<div
onClick>`). Am Telefon zählt: die **ganze** gestrichelte Fläche öffnet den Dialog.
- **Gäste-Karte nutzt `100dvh`** statt `100vh` — Prüfpunkt: beim ersten Scrollen darf die Karte
  nicht springen, wenn die Adressleiste einfährt.
- **Betreiber-Panel:** untere Leiste (drei Ziele im Betrieb, vier im Gästebuch), Hamburger-Schublade
  (nur Betrieb), klebende Tabellenkopfzeile, Sortier-Chips statt Auswahlfeld. Alles neu und
  ungeprüft am Gerät.

## Voraussetzungen

1. Rechner und Telefon im **gleichen WLAN** (kein Gäste-WLAN mit Client-Isolation — siehe „Bekannte
   Risiken").
2. Lokaler Supabase-Stack läuft: `npx supabase start`.
3. **Tenant + Event vorhanden.** Als Tenant im Dashboard einloggen → „Neue Kampagne". Welche
   Kampagnentypen wählbar sind, hängt an der Geschäftsart des Tenants (`tenants.business_type`,
   unveränderlich) — für alle drei Abläufe braucht es deshalb **drei Tenants**:
   - **Reiseagentur** → Kampagnentyp **Agentur / Reise** (`agency`, Flow `gallery`, mit
     Reziprozität). Hieß vor Migration 0016 `tour`.
   - **Hotel / Resort** → **Hotel / Aufenthalt** (`stay`, Flow `feedback`).
   - **Hochzeit / Event** → **Hochzeit/Event** (`wedding`, Flow `guestbook`).
     Alle drei mindestens einmal testen. Die `eventId` aus der URL notieren.
4. Dev-Server auf **allen Netzwerk-Interfaces** starten (nicht nur localhost):

   ```bash
   npm run dev -- -H 0.0.0.0
   ```

5. **LAN-IP des Rechners** ermitteln:
   - Windows: `ipconfig` → „IPv4-Adresse" (z. B. `192.168.43.250`).
   - Der Dev-Server zeigt sie ebenfalls an: `- Network: http://<LAN-IP>:3000`.
6. **QR-/Link-Hinweis (wichtig):** Der Dashboard-QR kodiert `NEXT_PUBLIC_APP_URL ?? http://localhost:3000`.
   `localhost` funktioniert vom Telefon **nicht**. Daher **eine** der Optionen:
   - `NEXT_PUBLIC_APP_URL=http://<LAN-IP>:3000` setzen und Dev-Server neu starten (QR stimmt dann), **oder**
   - am Telefon direkt `http://<LAN-IP>:3000/e/<eventId>` eintippen bzw. einen QR **dieser** URL erzeugen.

## Geräte-Matrix

Jeden Ablauf auf **beiden** durchführen:

- **A — iPhone / iOS Safari** (letzte 2 Hauptversionen)
- **B — Android / Chrome** (letzte 2 Hauptversionen)

---

## Teil A — Gäste-Ablauf (Schritt für Schritt)

### 0. Erreichbarkeit

Am Telefon `http://<LAN-IP>:3000` öffnen.
**Erwartet:** Startseite/Login lädt in < 2 s, kein Timeout. (Timeout → Firewall des Rechners
erlaubt Port 3000 nicht, oder WLAN-Client-Isolation.)

### 1. Landing `/e/<eventId>`

`http://<LAN-IP>:3000/e/<eventId>` öffnen (QR scannen oder eintippen).
**Erwartet:** Marken-/Kampagnenname + Kurzbeschreibung + CTA sichtbar. Layout füllt die
Bildschirmbreite **ohne horizontales Scrollen**, Text ist ohne Pinch-Zoom lesbar (Viewport greift).
Ungültige `eventId` → **404**.

**Neu (2026-08-17):** Der Auftritt ist cremefarbener Grund + **weiße** Karte, Kampagnenname in der
Anzeigeschrift (Serife), Marke als kleine Zeile darüber, Knopf als **Pille**. Kein roter
Kopfbalken, keine eckigen Ecken — sieht es so aus wie früher, hat die Schrift oder das Thema nicht
geladen (dann Konsole/Netzwerk prüfen: `--font-display`, `data-theme`).
**Scroll-Prüfung:** einmal nach unten und wieder nach oben wischen — die Karte darf **nicht
springen**, wenn die Adressleiste ein-/ausfährt (`100dvh`).

### 2. Consent-Gate

**Erwartet:** Consent-Checkbox ist **nicht** vorangehakt. Solange sie leer ist, ist der Weiter-/
Upload-Button **inaktiv**. Nach dem Anhaken wird er aktiv. (Serverseitig wird `consent_at` erst beim
Absenden gesetzt.)
**Trefferfläche:** Nicht nur das Kästchen, sondern die **ganze grau abgesetzte Zeile** schaltet
(nativer `<label>`) — mit dem Daumen irgendwo in den Text tippen und prüfen, dass der Haken
umspringt.

### 3. Kamera/Datei-Upload — Galerie-Ablauf (`gallery`)

Auf das Upload-Feld tippen.
**Erwartet:** nativer Dialog mit **„Foto aufnehmen" / „Mediathek" / „Dateien durchsuchen"** (iOS)
bzw. Kamera/Dateien (Android).

- **3a — Foto aufnehmen (Kamera):** Foto schießen → **Erwartet:** Vorschau erscheint,
  Fortschrittsanzeige läuft, Upload endet mit Erfolg.
- **3b — Mediathek, iPhone-Foto (HEIC):** ein normales Foto aus der Mediathek wählen →
  **Erwartet:** Upload gelingt und der Beitrag erscheint (Safari wandelt HEIC → JPEG). **Falls**
  „Dateityp nicht erlaubt / Upload fehlgeschlagen": **HEIC-Lücke notieren** (echter Befund).
- **3c — `.mov`-Video (iOS QuickTime):** ein iPhone-Video < 50 MB wählen → **Erwartet:** Upload +
  Fortschritt, Erfolg. Ein Video **> 50 MB** → **klare Fehlermeldung**, kein Absturz/Hänger.
- **3d — Ungültiger Typ:** (falls über „Dateien" erreichbar) z. B. PDF wählen → **Erwartet:**
  abgelehnt mit verständlicher Meldung.

**Erwartet generell:** Fortschrittsanzeige sichtbar; nach Erfolg wird der „Galerie anzeigen"-Button
aktiv.

### 4. Reziprozitätssperre + Galerie (`gallery`)

**Erwartet:** **Vor** einem abgeschlossenen Upload ist die Galerie **nicht** erreichbar. **Nach** dem
Upload öffnet die Galerie und zeigt genehmigte, **nicht geflaggte** Beiträge — der eigene Beitrag
erscheint. Medien (Bild/Video) laden über signierte URLs.

### 5. Bewertung (optional, `gallery`)

1–5 Sterne wählen **oder** „Überspringen".
**Erwartet:** Auswahl wird gespeichert (später im Dashboard sichtbar), Überspringen bricht nichts.

**Neu (2026-08-17), der eigentliche Prüfpunkt hier:** Die Sterne sind Grafiken mit **44px**
Trefferfläche. Gezielt den **dritten von fünf** treffen — bei der Gesamtnote **und** bei jeder
Zusatzfrage (Agentur-Reise hat vier: Reiseerlebnis, Organisation, Service, Preis-Leistung). Vorher
waren die Fragen-Sterne ~24px groß und das Treffen Glückssache. Auf 360px stehen Frage und Sterne
**untereinander**; nebeneinander erst ab 480px.

### 3'/4'. Feedback-Ablauf (`feedback`, Event vom Typ `stay`)

Statt Galerie: Feedback-Formular nach dem Consent.
**Erwartet:** Bewertung (1–5) **und/oder** Kommentar; optionales Foto/Video (`accept` wie oben).
Mindestens **Bewertung ODER Kommentar** ist Pflicht (leer → Hinweis). Absenden → Dankeschön-Bildschirm,
**keine Galerie, keine Reziprozität**.

### 3''/4''. Gästebuch-Ablauf (`guestbook`, Event vom Typ `wedding`)

Fehlte in der ersten Fassung — der Modus kam erst mit Migration 0018 dazu.

Nach dem Consent erscheint ein Formular mit **Name** (Pflicht), **Glückwunsch** (Freitext),
optional „Beschreibt die Feier in drei Worten" und optional **mehrere** Fotos/Videos (max. 10).
**Erwartet:**

- Ohne Namen → Hinweis, kein Absenden. Ohne Gruß **und** ohne Datei → Hinweis.
- Mehrfachauswahl aus der Mediathek funktioniert; der Fortschritt zählt „Datei 2 von 3".
- Nur Gruß, keine Datei → Beitrag wird trotzdem gespeichert (medienloser Gruß).
- Abschluss: Dankeschön mit Blumen-Symbol, danach **keine Galerie** (das Gästebuch ist
  geschlossen — Gäste sehen die Beiträge der anderen nicht).
- **Tastatur:** Beim Fokus in „Glückwünsche" scrollt das Feld über die Tastatur, das Layout bricht
  nicht; die Karte bleibt schmaler als der Bildschirm.

### 6. Löschung (DSGVO, `gallery`/`feedback`/`guestbook`)

„Löschen" am eigenen Beitrag antippen und bestätigen.
**Erwartet:** Der Beitrag verschwindet aus der Ansicht.
**Hinweis:** Der Gäste-Button wertet den HTTP-Status **nicht** aus (fire-and-forget) und meldet
„gelöscht" auch bei Serverfehler — für einen echten Statusnachweis siehe
`supabase/tests/gdpr_delete_failpath_proof.md`. Hier zählt die sichtbare Entfernung.

### 7. Layout 360–428 px

Auf dem schmalsten verfügbaren Gerät prüfen (Referenz: iPhone SE ≈ 375 px; kleinste Zielbreite
360 px).
**Erwartet:** kein horizontales Scrollen; Buttons/Checkbox voll tippbar (Trefferfläche ~44 px);
Consent-Text vollständig lesbar; Sterne, Upload-Feld und Vorschau nicht abgeschnitten.

### 8. Tastatur & Orientierung

Kommentar-/Namensfeld fokussieren (Feedback/Guestbook).
**Erwartet:** Die Seite scrollt das Feld über die eingeblendete Tastatur, das Layout bricht nicht.
Kurz ins Querformat drehen → keine Überlappungen/abgeschnittenen Steuerelemente.

---

## Teil B — Betreiber-Panel am Telefon (`/dashboard`)

Am Telefon einloggen (`http://<LAN-IP>:3000/login`). Diese Oberfläche ist beim mobilen Umbau
entstanden und **bisher nur im Browser bei 360/390px gemessen** — die Punkte hier sind genau die,
die eine Messung nicht beantwortet.

Je Geschäftsart einmal durchgehen: die untere Leiste und der Umfang der Navigation hängen an den
Fähigkeiten des Tenants (`resolveDashboardCapabilities`), nicht am Geschmack.

### B1. Untere Leiste

**Erwartet — Betrieb (Hotel/Agentur):** DREI Ziele: Übersicht · Antworten/Rückmeldungen · Medien.
**Erwartet — Gästebuch (Hochzeit):** VIER: Übersicht · Galerie · QR-Code · Einstellungen.
Beschriftungen kommen aus der Registry („Aufenthalte", „Reisen", „Glückwünsche").
**Zu prüfen:** jedes Ziel blind mit dem Daumen treffbar (≥44px hoch), aktives Ziel farbig markiert,
und auf iPhones mit Home-Indikator liegt die Leiste **nicht** unter der Wischleiste
(`env(safe-area-inset-bottom)`). Aus einer Detailseite zurück → das übergeordnete Ziel bleibt
markiert (Präfix-Treffer).

### B2. Hamburger-Schublade (nur Betrieb)

**Erwartet:** Im Betrieb öffnet der Knopf links in der Kopfleiste eine Schublade mit dem Rest
(Kampagnen/Reisen · Berichte · Einstellungen) plus Tarif-Fußzeile. Ein Tipp auf den dunklen
Hintergrund schließt sie.
**Erwartet — Gästebuch:** **kein** Hamburger. Stattdessen führt „Alle Feiern (mit Archiv)" unter
den Kennzahlen der Übersicht zur Liste, und die Kennzahl „Glückwünsche" zu den Beiträgen. Beide
Wege antippen — ohne sie wären diese Seiten am Telefon unerreichbar (das war ein echter Befund,
siehe Commit `73a7c1f`).

### B3. Klebende Tabellenkopfzeile + Sortier-Chips (`/dashboard/experiences`)

Am Telefon steht die Kopfzeile der Liste als **Chipzeile**: `Name · Datum · Auslastung` (die nicht
sortierbaren Spalten Typ/Status erscheinen dort nicht).
**Erwartet:**

- Einen Chip antippen → die Liste ordnet sich neu, der Chip färbt sich (Akzent) und trägt einen
  Pfeil. **Nochmal** tippen → Pfeil dreht, Reihenfolge kehrt um.
- Weit nach unten scrollen (bei wenigen Kampagnen vorher „Alle" filtern, damit die Liste lang wird):
  die Chipzeile **bleibt stehen**, direkt unter der Kopfleiste, und die Zeilen laufen darunter
  durch — nichts scheint durch (deckender Grund).
- Jede Zeile trägt ihre Beschriftungen selbst („Datum", „Typ", „Status", „Auslastung"), weil die
  Spaltenüberschriften am Telefon fehlen.
- Filter setzen (Schalter „Filter"), dann sortieren: **beides** bleibt gleichzeitig aktiv. Danach
  einen Filter-Chip mit „×" abwerfen → die Sortierung darf **nicht** zurückspringen.

### B4. Album / Medien (`/dashboard/media`)

**Erwartet:** Beitragsstrom (Karten), ein Foto antippen öffnet das Vollbild; Wischen/Pfeile
wechseln, „Schließen" führt zurück an dieselbe Stelle der Liste. Die Werkzeuge (Sperren,
Herunterladen, Löschen) liegen im Vollbild, nicht unter jeder Karte.

### B5. Breite und Zoom

Auf 360–428px: **kein horizontales Scrollen** auf Übersicht, Liste, Antworten, Medien,
Einstellungen. Kennzahlen stehen zweispaltig. Kein Pinch-Zoom nötig, um Zahlen zu lesen.

---

## Ergebnis-Matrix (pro Gerät abhaken)

| Prüfung                                    | iOS Safari | Android Chrome |
| ------------------------------------------ | ---------- | -------------- |
| 0 Erreichbarkeit (< 2 s, kein Timeout)     |            |                |
| 1 Landing, kein H-Scroll, lesbar           |            |                |
| 1 Neuer Auftritt (Creme/Serife/Pille)      |            |                |
| 1 Karte springt nicht beim Scrollen (dvh)  |            |                |
| 2 Consent-Gate blockiert Button            |            |                |
| 2 Ganze Consent-Zeile schaltet             |            |                |
| 3a Foto aufnehmen → Upload OK              |            |                |
| 3b Mediathek/HEIC → Upload OK              |            |                |
| 3c `.mov` < 50 MB → Upload OK              |            |                |
| 3c `.mov` > 50 MB → klarer Fehler          |            |                |
| 4 Reziprozität + Galerie sichtbar          |            |                |
| 5 Bewertung optional/Überspringen          |            |                |
| 5 Dritter Stern trifft (Note + Fragen)     |            |                |
| 3'/4' Feedback-Formular (stay-Event)       |            |                |
| 3''/4'' Gästebuch (wedding-Event)          |            |                |
| 6 Löschen entfernt Beitrag                 |            |                |
| 7 Layout 360–428 px sauber                 |            |                |
| 8 Tastatur/Orientierung ok                 |            |                |
| B1 Untere Leiste (3 bzw. 4 Ziele, Daumen)  |            |                |
| B2 Schublade / kein Hamburger im Gästebuch |            |                |
| B2 „Alle Feiern" + Kennzahl führen weiter  |            |                |
| B3 Chipzeile klebt, Sortieren dreht        |            |                |
| B3 Filter + Sortierung stören sich nicht   |            |                |
| B4 Vollbild öffnet/schließt an der Stelle  |            |                |
| B5 Panel ohne H-Scroll bei 360 px          |            |                |

## Bekannte Risiken / worauf achten

- **iOS HEIC** (Schritt 3b): häufigster echter Stolperstein — Safari sollte transcodieren; wenn nicht,
  accept-Liste + Server-MIME um HEIC/HEIF erweitern.
- **Große `.mov`** (Schritt 3c): iPhone-Videos werden schnell > 50 MB; die Fehlermeldung muss klar
  sein, nicht ein stiller Hänger.
- **WLAN-Client-Isolation:** Gäste-/Hotel-WLAN blockiert oft Peer-zu-Peer — dann ist der Rechner vom
  Telefon nicht erreichbar. Privates WLAN oder Handy-Hotspot (Rechner + Telefon daran) nutzen.
- **`localhost` im QR / in der Adresse:** siehe Voraussetzung 6. Am Telefon ist `localhost` **das
  Telefon selbst** — immer die LAN-IP verwenden (`http://<LAN-IP>:3000/e/<eventId>`), nie `localhost`.
- **CSP `upgrade-insecure-requests` bricht HTTP-LAN (verifiziert 2026-07-31):** Symptom — Seite lädt,
  aber **nichts ist interaktiv** (Consent-Checkbox hakt optisch an, „Weiter" bleibt aber deaktiviert).
  Ursache: Die Sicherheits-CSP zwingt alle Subressourcen (JS-Chunks) auf HTTPS; der Dev-Server hat
  kein TLS über die LAN-IP → Chunks laden nicht → **keine Hydration**. `localhost` ist als „secure
  context" ausgenommen, daher fällt es nur am echten Gerät auf. **Behoben:** `next.config.ts` setzt
  `upgrade-insecure-requests` + HSTS jetzt **nur in Produktion** (Prod-Sicherheit unverändert). Nach
  einer `next.config.ts`-Änderung Dev-Server **neu starten** und am Telefon die Seite hart neu laden.
- **Video/Medien evtl. durch CSP blockiert (Schritt 4):** `media-src` ist nur `'self' blob:` (ohne
  Supabase-Host) und `Cross-Origin-Embedder-Policy: require-corp` kann cross-origin Supabase-Medien
  sperren. Falls Galerie-**Videos** nicht abspielen bzw. Medien leer bleiben → eigener Befund
  (`media-src`/COEP), gilt auch in Produktion.
- **Windows-Firewall:** beim ersten `-H 0.0.0.0`-Start ggf. Freigabe für Node/Port 3000 bestätigen.
- **Klebende Kopfzeile auf 641–1024px (Tablet):** Der Versatz der Tabellenkopfzeile ist die Höhe der
  Kopfleiste (`--gs-topbar-h: 56px`, nur unter 1025px gesetzt). Sitzt die Chipzeile **hinter** der
  Kopfleiste statt darunter, stimmt diese Zahl nicht mehr mit der tatsächlichen Höhe überein — dann
  ist `min-height` der `.gs-topbar` das erste, wo man nachsieht.
- **Kein `aria-sort`:** Ein Screenreader hört an der Chipzeile Links („Datum — nach dieser Spalte
  absteigend sortieren"), keine Tabellenüberschriften. Das ist Absicht (die Listen sind Raster, keine
  Tabellen); wer mit VoiceOver/TalkBack prüft, sollte es wissen und nicht als Befund notieren.

## Nach dem Lauf

Ergebnisse festhalten; Abweichungen als Befund/Issue notieren (mit Gerät + iOS/Chrome-Version).
Bei durchgängigem Bestehen von **Teil A** sind **NFR-04.1/.2/.3** (mobile Kompatibilität) und
**NFR-01.1** (FCP) verifiziert — im Härtungs-Inventar Punkt **Z1** als erledigt markieren.
**Teil B** hängt an keiner NFR; er schließt die Lücke, dass das mobile Panel bisher ausschließlich
im Browser gemessen wurde.
