# Mobiler Smoke-Test — Gäste-Ablauf (echtes Gerät)

Verifiziert den Gäste-Ablauf auf **echten Mobilgeräten** (nicht Emulator, nicht nur DevTools),
weil iOS Safari / Android Chrome Eigenheiten haben, die Desktop nicht zeigt (Kamera-Dialog,
HEIC-Fotos, `.mov`-Videos, Tastatur/Viewport). Deckt **NFR-04.1/.2/.3** und **NFR-01.1**
(`docs/30-requirements.md`) ab.

**Kein Vercel/Deploy nötig** — der lokale Dev-Server wird im selben WLAN vom Telefon erreichbar
gemacht. Dies ist ein **manueller** Test; die Schritte unten sind zum Abhaken.

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

## Voraussetzungen

1. Rechner und Telefon im **gleichen WLAN** (kein Gäste-WLAN mit Client-Isolation — siehe „Bekannte
   Risiken").
2. Lokaler Supabase-Stack läuft: `npx supabase start`.
3. **Tenant + Event vorhanden.** Als Tenant im Dashboard einloggen → „Neue Kampagne":
   - Für den **Galerie-Ablauf** (Reziprozität): Kampagnentyp **Tour** (`gallery`).
   - Für den **Feedback-Ablauf**: Kampagnentyp **Hotel/Aufenthalt** (`stay`, `feedback`).
     Beide mindestens einmal testen. Die `eventId` aus der URL notieren.
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

## Ablauf (Schritt für Schritt)

### 0. Erreichbarkeit

Am Telefon `http://<LAN-IP>:3000` öffnen.
**Erwartet:** Startseite/Login lädt in < 2 s, kein Timeout. (Timeout → Firewall des Rechners
erlaubt Port 3000 nicht, oder WLAN-Client-Isolation.)

### 1. Landing `/e/<eventId>`

`http://<LAN-IP>:3000/e/<eventId>` öffnen (QR scannen oder eintippen).
**Erwartet:** Marken-/Kampagnenname + Kurzbeschreibung + CTA sichtbar. Layout füllt die
Bildschirmbreite **ohne horizontales Scrollen**, Text ist ohne Pinch-Zoom lesbar (Viewport greift).
Ungültige `eventId` → **404**.

### 2. Consent-Gate

**Erwartet:** Consent-Checkbox ist **nicht** vorangehakt. Solange sie leer ist, ist der Weiter-/
Upload-Button **inaktiv**. Nach dem Anhaken wird er aktiv. (Serverseitig wird `consent_at` erst beim
Absenden gesetzt.)

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

### 3'/4'. Feedback-Ablauf (`feedback`, Event vom Typ `stay`)

Statt Galerie: Feedback-Formular nach dem Consent.
**Erwartet:** Bewertung (1–5) **und/oder** Kommentar; optionales Foto/Video (`accept` wie oben).
Mindestens **Bewertung ODER Kommentar** ist Pflicht (leer → Hinweis). Absenden → Dankeschön-Bildschirm,
**keine Galerie, keine Reziprozität**.

### 6. Löschung (DSGVO, `gallery`/`feedback`)

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

## Ergebnis-Matrix (pro Gerät abhaken)

| Prüfung                                | iOS Safari | Android Chrome |
| -------------------------------------- | ---------- | -------------- |
| 0 Erreichbarkeit (< 2 s, kein Timeout) |            |                |
| 1 Landing, kein H-Scroll, lesbar       |            |                |
| 2 Consent-Gate blockiert Button        |            |                |
| 3a Foto aufnehmen → Upload OK          |            |                |
| 3b Mediathek/HEIC → Upload OK          |            |                |
| 3c `.mov` < 50 MB → Upload OK          |            |                |
| 3c `.mov` > 50 MB → klarer Fehler      |            |                |
| 4 Reziprozität + Galerie sichtbar      |            |                |
| 5 Bewertung optional/Überspringen      |            |                |
| 3'/4' Feedback-Formular (stay-Event)   |            |                |
| 6 Löschen entfernt Beitrag             |            |                |
| 7 Layout 360–428 px sauber             |            |                |
| 8 Tastatur/Orientierung ok             |            |                |

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

## Nach dem Lauf

Ergebnisse festhalten; Abweichungen als Befund/Issue notieren (mit Gerät + iOS/Chrome-Version).
Bei durchgängigem Bestehen sind **NFR-04.1/.2/.3** (mobile Kompatibilität) und **NFR-01.1** (FCP)
verifiziert — im Härtungs-Inventar Punkt **Z1** als erledigt markieren.
