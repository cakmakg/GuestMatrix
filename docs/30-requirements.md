# GuestMatrix — Anforderungen & Wireframe-Ablauf

> Phasen-Label: **MVP** = Phase 0, **V2** = Phase 2, **Later** = unbestimmte Zukunft.
> Für die Phase-0-Ausschlussliste wird `docs/phase0.md` als Referenz herangezogen.

---

## 1. User Flows

### A. Unternehmensregistrierung (Self-serve)

1. Nutzer gelangt auf die Landing Page; klickt auf „Unternehmenskonto erstellen" (CTA).
2. Wählt den Unternehmenstyp: **Reiseagentur / Reiseleiter** · Hotel / Resort _(V2)_.
3. Füllt das Formular aus: Firmenname, Ansprechpartner, E-Mail, Passwort, Land.
4. System erstellt das Konto; sendet eine Bestätigungs-E-Mail.
5. Nach E-Mail-Bestätigung wird der Nutzer zum Onboarding-Bildschirm weitergeleitet.

> **Phase-0-Hinweis:** Self-serve-Registrierung ist nicht im Umfang. Reiseleiter werden in Phase 0
> manuell angelegt (Seed-Skript / direkt in der DB). Dieser Flow wird in V2 aktiviert.

---

### B. Anmeldung (Login)

1. Nutzer gibt E-Mail und Passwort ein.
2. System prüft die Anmeldedaten und findet den Tenant-Eintrag.
3. Erfolgreiche Anmeldung → Nutzer wird zu seinem Dashboard weitergeleitet.
4. Fehlgeschlagene Anmeldung → klare Fehlermeldung + Link „Passwort vergessen".
5. Passwort-Zurücksetzen: Einmal-Link wird per E-Mail gesendet; Link läuft nach einer Zeit ab.

---

### C. Onboarding (Ersteinrichtung)

1. Nutzer vervollständigt das Unternehmensprofil:
   - Logo hochladen _(V2)_
   - Markenname (wird auf der Gästeseite angezeigt)
   - Kontaktdaten
   - Branchentyp (wird automatisch befüllt, wenn bei der Registrierung angegeben)
2. System leitet den Nutzer zur Erstellung der ersten Kampagne weiter.

> **Phase-0-Hinweis:** Onboarding-Wizard ist nicht im Umfang. Nach Erstellung des Tenant-Eintrags
> gelangt der Nutzer direkt ins Dashboard.

---

### D. Kampagne / Veranstaltung erstellen

1. Nutzer klickt im Dashboard auf „Neue Veranstaltung erstellen".
2. Gibt die Grunddaten ein: Kampagnenname, Datum, Ort _(optional)_, Beschreibung _(optional)_.
3. Wählt die Gäste-Formular-Module:
   - Foto/Video-Upload → **an/aus** (Phase 0: immer an)
   - Textkommentar → **an/aus** _(V2)_
   - Bewertung/Emoji → **an/aus** (Phase 0: immer an, 1–5 Sterne)
   - Review-Weiterleitung → **an/aus** _(V2)_
4. System erstellt die Kampagne und generiert einen eindeutigen QR-Code.
5. QR-Code wird als PNG heruntergeladen oder der Freigabe-Link kopiert.

---

### E. Gäste-Ablauf

1. Gast scannt den QR-Code mit der Kamera.
2. Mobile Webseite öffnet sich; Markenname und Veranstaltungsname werden angezeigt.
3. Consent-Bildschirm: DSGVO-Hinweistext + Einwilligungs-Checkbox (kein Voranklicken).
   Ohne Einwilligung kann nicht fortgefahren werden.
4. Upload-Bildschirm: Foto oder Video auswählen (max. 50 MB, erlaubte Formate).
   Fortschrittsbalken wird angezeigt.
5. Upload abgeschlossen → Reziprozitätssperre öffnet sich → Galerie wird sichtbar
   _(Phase-0-Schlossmechanik: erst beitragen, dann sehen)_.
6. Bewertungsbildschirm (optional, überspringbar): 1–5 Sterne oder Emoji.
7. Dankeschön-Bildschirm:
   - Zufriedener Nutzer → „Bewertung auf Google schreiben"-Link _(V2)_
   - Unzufriedener Nutzer → individuelles Feedback-Formular _(V2)_
   - Phase 0: alle Nutzer landen auf dem Dankeschön-Bildschirm.

---

### F. Ergebnisbildschirm / Unternehmens-Dashboard

1. Nutzer navigiert vom Dashboard zur Veranstaltungsdetailseite.
2. Oberer Bereich — KPI-Karten:
   - Gesamtanzahl QR-Scans _(V2 — separater Dienst für Scan-Tracking erforderlich)_
   - Anzahl abgeschlossener Einreichungen
   - Anzahl gesammelter Fotos/Videos
   - Durchschnittsbewertung
3. Inhalts-Grid: Thumbnails, Upload-Datum, Moderationsstatus.
4. Aktionen:
   - Inhalt flaggen / Flag aufheben (Moderation).
   - Einzelnen Inhalt herunterladen.
   - ZIP-Massenexport _(V2)_.
   - Inhalt als „marketinggenehmigt" markieren _(V2)_.
5. Feedback-Tab: Bewertungen und Kommentarliste _(V2 — in Phase 0 nur Bewertungsanzahl und -durchschnitt)_.

---

## 2. Functional Requirements

### FR-01 — Authentifizierung & Session

| ID      | Anforderung                                                                                                                                               | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-01.1 | Das System ermöglicht die Anmeldung mit E-Mail + Passwort via `supabase.auth.signInWithPassword()`.                                                       | MVP   |
| FR-01.2 | Bei fehlgeschlagener Anmeldung wird eine Fehlermeldung angezeigt; Passwortdetails werden nicht offengelegt.                                               | MVP   |
| FR-01.3 | Die Session wird mit Supabase JWT verwaltet; Tenant-Informationen werden aus der `tenants`-Tabelle per `user_id`-Join abgerufen.                          | MVP   |
| FR-01.4 | Passwort-Zurücksetzen: `supabase.auth.resetPasswordForEmail()` — Supabase sendet einen zeitlich begrenzten Magic Link.                                    | MVP   |
| FR-01.5 | Gäste-Session wird mit `supabase.auth.signInAnonymously()` erstellt; die zurückgegebene `user.id` wird als `guest_user_id` in die Submission geschrieben. | MVP   |
| FR-01.6 | Self-serve-Registrierungsablauf (Formular + E-Mail-Verifizierung).                                                                                        | V2    |
| FR-01.7 | OAuth- / Magic-Link-Unterstützung.                                                                                                                        | Later |

### FR-02 — Tenant-Verwaltung

| ID      | Anforderung                                                                                         | Phase |
| ------- | --------------------------------------------------------------------------------------------------- | ----- |
| FR-02.1 | Jedes Unternehmenskonto wird als unabhängiger Tenant geführt; Daten sind strikt getrennt.           | MVP   |
| FR-02.2 | Pro Tenant werden Markenname und Kontaktdaten gespeichert; diese werden auf der Gästeseite genutzt. | MVP   |
| FR-02.3 | Onboarding-Wizard: Logo, Markenfarbe, Sprachpräferenz.                                              | V2    |
| FR-02.4 | Mehrbenutzer- / Rollenverwaltung pro Tenant.                                                        | Later |

### FR-03 — Kampagnen- / Veranstaltungsverwaltung

| ID      | Anforderung                                                                               | Phase |
| ------- | ----------------------------------------------------------------------------------------- | ----- |
| FR-03.1 | Unternehmensnutzer kann eine neue Veranstaltung erstellen (Name + Datum Pflichtfelder).   | MVP   |
| FR-03.2 | Für jede Veranstaltung wird ein eindeutiger QR-Code generiert; als PNG herunterladbar.    | MVP   |
| FR-03.3 | Vom QR-Code kodierte URL: `/e/[eventId]`; eventId darf nicht vorhersehbar sein.           | MVP   |
| FR-03.4 | Veranstaltungsliste ist im Dashboard abrufbar; Filtern und Sortieren möglich.             | MVP   |
| FR-03.5 | Zuweisung eines Kampagnentyps zur Veranstaltung (Tour, Kreuzfahrt, Aufenthalt, Event).    | V2    |
| FR-03.6 | Modulbasierte Formulareinstellungen: Kommentar / Bewertung / Review-Weiterleitung an/aus. | V2    |

### FR-04 — Gäste-Ablauf

| ID       | Anforderung                                                                                                                           | Phase |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-04.1  | Seite `/e/[eventId]`: Markenname + Veranstaltungsinfo werden angezeigt. Ungültige ID → 404.                                           | MVP   |
| FR-04.2  | Consent-Checkbox (Pflicht, kein Voranklicken); Einwilligungszeitpunkt wird in DB gespeichert. Upload startet nicht ohne Einwilligung. | MVP   |
| FR-04.3  | Gast kann Foto/Video hochladen (jpg, png, mp4, mov; max. 50 MB).                                                                      | MVP   |
| FR-04.4  | Während des Uploads wird eine Fortschrittsanzeige angezeigt.                                                                          | MVP   |
| FR-04.5  | Reziprozitätssperre: ohne mindestens 1 erfolgreichen Upload kein Galerie-Zugriff.                                                     | MVP   |
| FR-04.6  | Galerie: alle nicht geflaggten und nicht gelöschten Inhalte werden angezeigt.                                                         | MVP   |
| FR-04.7  | Bewertung (1–5 Sterne) ist optional; überspringbar.                                                                                   | MVP   |
| FR-04.8  | Gast kann seinen eigenen hochgeladenen Inhalt löschen (DSGVO-Löschpfad).                                                              | MVP   |
| FR-04.9  | Textkommentarfeld.                                                                                                                    | V2    |
| FR-04.10 | Review- / individuelles Feedback-Weiterleitung abhängig vom Zufriedenheitswert.                                                       | V2    |
| FR-04.11 | Drittanbieter-Review-Link auf dem Dankeschön-Bildschirm (Google, TripAdvisor).                                                        | V2    |

### FR-05 — Inhaltsmoderation

| ID      | Anforderung                                                                                                                                 | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-05.1 | Jede Submission wird nach dem Upload mit `moderationFlag: false` erstellt.                                                                  | MVP   |
| FR-05.2 | Unternehmensnutzer kann Inhalte flaggen / Flag aufheben. Geflaggte Inhalte sind in der Galerie unsichtbar.                                  | MVP   |
| FR-05.3 | Moderations-Stub: Beim Upload wird der Inhalt an einen KI-Dienst gesendet; bei schwerwiegenden Verstößen wird das Flag automatisch gesetzt. | V2    |

### FR-06 — Unternehmens-Dashboard & Analytics

| ID      | Anforderung                                                               | Phase |
| ------- | ------------------------------------------------------------------------- | ----- |
| FR-06.1 | Veranstaltungsdetailseite: Gesamtanzahl Uploads, Durchschnittsbewertung.  | MVP   |
| FR-06.2 | Inhalts-Grid: Thumbnail, Upload-Datum, Moderationsstatus, Einzeldownload. | MVP   |
| FR-06.3 | Einzeldownload (volle Auflösung).                                         | MVP   |
| FR-06.4 | Gesamtanzahl QR-Scans.                                                    | V2    |
| FR-06.5 | ZIP-Massenexport.                                                         | V2    |
| FR-06.6 | Inhalt als „marketinggenehmigt" markieren und filtern.                    | V2    |
| FR-06.7 | Häufigste Kommentarthemen (NLP-Zusammenfassung).                          | Later |

---

## 3. Non-Functional Requirements

### NFR-01 — Performance

| ID       | Anforderung                                                                                                    | Schwellenwert           | Phase |
| -------- | -------------------------------------------------------------------------------------------------------------- | ----------------------- | ----- |
| NFR-01.1 | Gäste-Startseite (`/e/[eventId]`) — First Contentful Paint (FCP).                                              | ≤ 2 s (4G mobil)        | MVP   |
| NFR-01.2 | Antwortzeit der Upload-Presign-API.                                                                            | ≤ 500 ms (p95)          | MVP   |
| NFR-01.3 | Ladezeit der Veranstaltungsliste und KPI-Karten im Dashboard.                                                  | ≤ 3 s (p95)             | MVP   |
| NFR-01.4 | Bei schwacher Verbindung (3G) müssen die Kernschritte des Gäste-Ablaufs (Consent + Upload-Start) nutzbar sein. | Kernablauf funktioniert | MVP   |

### NFR-02 — Sicherheit

| ID       | Anforderung                                                                                                                                   | Phase |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| NFR-02.1 | Alle API-Endpunkte laufen über HTTPS; HTTP-Redirect ist aktiv.                                                                                | MVP   |
| NFR-02.2 | Jede Tabelle ist per RLS-Policy auf den Tenant-Scope gesperrt; tenant-übergreifender Datenzugriff wird auf DB-Ebene verhindert.               | MVP   |
| NFR-02.3 | Die Unternehmens-Dashboard-Session wird per Supabase Auth JWT verwaltet (httpOnly Cookie, vom Supabase-Client gesetzt).                       | MVP   |
| NFR-02.4 | Die Gäste-Session wird per Supabase Anonymous Auth JWT verwaltet; kein benutzerdefinierter sessionToken oder Cookie-Mechanismus erforderlich. | MVP   |
| NFR-02.5 | Passwortverwaltung erfolgt durch Supabase Auth; kein Hashing auf Anwendungsebene.                                                             | MVP   |
| NFR-02.6 | API-Eingaben werden mit Zod validiert; Handler ohne Validierung werden nicht gemergt.                                                         | MVP   |
| NFR-02.7 | Upload: Dateityp wird serverseitig validiert (MIME-Sniffing; reine Extension-Prüfung reicht nicht aus).                                       | MVP   |
| NFR-02.8 | Secret-Werte werden nur in Umgebungsvariablen gespeichert; Variablen ohne `NEXT_PUBLIC_`-Präfix gelangen nicht zum Client.                    | MVP   |
| NFR-02.9 | Brute-Force-Schutz: Rate-Limiting am Anmelde-Endpunkt.                                                                                        | V2    |

### NFR-03 — Datenschutz (DSGVO)

| ID       | Anforderung                                                                                                                        | Phase |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- |
| NFR-03.1 | Gästemedien sind personenbezogene Daten. Ohne zuvor gespeicherten Consent darf kein Inhalt erstellt werden.                        | MVP   |
| NFR-03.2 | Löschpfad ist Pflicht: Auf Gästeanfrage wird der Inhalt in der DB soft-deleted + aus dem Storage hard-deleted.                     | MVP   |
| NFR-03.3 | `consentAt`-Zeitstempel wird in jedem Submission-Eintrag gespeichert; Prüfpfad bleibt erhalten.                                    | MVP   |
| NFR-03.4 | Datenspeicherrichtlinie: Medien werden X Tage nach Veranstaltungsende automatisch gelöscht _(Richtlinientext noch zu definieren)_. | V2    |
| NFR-03.5 | Datenschutzhinweistext wird auf dem Gäste-Consent-Bildschirm angezeigt (Sprache: DE/EN).                                           | MVP   |

### NFR-04 — Mobile Kompatibilität

| ID       | Anforderung                                                                                              | Phase |
| -------- | -------------------------------------------------------------------------------------------------------- | ----- |
| NFR-04.1 | Gäste-Ablauf erfordert keine native mobile App; funktioniert über mobiles Web.                           | MVP   |
| NFR-04.2 | Gästeseiten sind auf iOS Safari und Android Chrome (letzte 2 Hauptversionen) vollständig funktionsfähig. | MVP   |
| NFR-04.3 | Gäste-Benutzeroberfläche wird bei 360 px – 428 px Bildschirmbreite korrekt dargestellt.                  | MVP   |
| NFR-04.4 | Browser-Berechtigungsablauf für Kamera-/Galerie-Zugriff führt den Gast durch den Prozess.                | MVP   |

### NFR-05 — Benutzerfreundlichkeit

| ID       | Anforderung                                                                                                        | Phase |
| -------- | ------------------------------------------------------------------------------------------------------------------ | ----- |
| NFR-05.1 | Der Gäste-Ablauf Consent → Upload → Galerie wird in 3 Bildschirmen abgeschlossen; Schrittanzahl wird nicht erhöht. | MVP   |
| NFR-05.2 | Fehlermeldungen werden in der Nutzersprache und ohne technischen Jargon angezeigt.                                 | MVP   |
| NFR-05.3 | Das Unternehmens-Dashboard ist von nicht-technischen Nutzern (Reiseleiter) ohne Schulung bedienbar.                | MVP   |

### NFR-06 — Zuverlässigkeit & Skalierbarkeit

| ID       | Anforderung                                                                                                                                                                      | Phase |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| NFR-06.1 | Anwendung wird auf Vercel deployed; Plattform-SLA (99,9 %) wird akzeptiert.                                                                                                      | MVP   |
| NFR-06.2 | Supabase-Client wird als Singleton auf Modulebene initialisiert; PgBouncer-Connection-Pool wird auf Supabase-Seite verwaltet. Pro Route Handler wird kein neuer Client erstellt. | MVP   |
| NFR-06.3 | Media-Upload erfolgt direkt vom Client zu Supabase Storage (`createSignedUploadUrl`); der Next.js-Server transferiert keine Binärdaten.                                          | MVP   |
| NFR-06.4 | Das System muss mit wachsenden Tenant- und Medienzahlen horizontal skalierbar sein (Vercel + Supabase managed Postgres + Supabase Storage).                                      | V2    |

---

## 4. Wireframe-Ablauf

> Ziel ist die Definition des Bildschirmskeletts, nicht des visuellen Designs. Jeder Block
> repräsentiert einen UI-Bereich.

---

### Bildschirm 1 — Landing Page

```
┌─────────────────────────────────────────────────────┐
│  [Logo]                              [Anmelden]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Gästeinhalte und Feedback                         │
│   per QR an einem Ort sammeln.                      │
│                                                     │
│   [ Reiseagentur / Reiseleiter ]  [ Hotel / Resort* ]│
│                                                     │
│          [ Unternehmenskonto erstellen* ]            │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [QR-Inhalt]  [Feedback]  [UGC]  [Dashboard*]       │
└─────────────────────────────────────────────────────┘
* V2
```

---

### Bildschirm 2 — Registrierungsformular _(V2)_

```
┌───────────────────────────────────────────────────┐
│  Wertversprechen (kurz)  │  ┌─────────────────┐   │
│                          │  │ Unternehmenstyp ▾│   │
│  • QR-Inhalt sammeln     │  │ Firmenname      │   │
│  • Echtzeit-Dashboard    │  │ Vor- und Nachname│   │
│  • DSGVO-konform         │  │ E-Mail          │   │
│                          │  │ Passwort        │   │
│                          │  │ Land ▾          │   │
│                          │  │ [Konto erstellen]│   │
│                          │  └─────────────────┘   │
└───────────────────────────────────────────────────┘
```

---

### Bildschirm 3 — Anmeldung (Login)

```
┌─────────────────────────────┐
│         [Logo]              │
│                             │
│  E-Mail                     │
│  ┌─────────────────────┐    │
│  └─────────────────────┘    │
│  Passwort                   │
│  ┌─────────────────────┐    │
│  └─────────────────────┘    │
│  [ Passwort vergessen ]     │
│  [ Anmelden ]               │
└─────────────────────────────┘
```

---

### Bildschirm 4 — Onboarding-Stepper _(V2)_

```
┌──────────────────────────────────────────────────────┐
│  1.Unternehmen  2.Marke  3.Kampagnentyp  4.QR        │
│  ●──────────────○─────────────○───────────○          │
├─────────────────────────────────┬────────────────────┤
│  [Formularfelder — aktiver     │  Mobile Vorschau    │
│   Schritt]                     │  ┌──────────────┐  │
│                                │  │ Markenname   │  │
│  [ Zurück ]    [ Weiter ]      │  │ ...          │  │
│                                │  └──────────────┘  │
└─────────────────────────────────┴────────────────────┘
```

---

### Bildschirm 5 — Dashboard (Unternehmens-Panel)

```
┌──────────┬──────────────────────────────────────────┐
│ [Logo]   │  Willkommen, [Name]         [Profil ▾]   │
├──────────┼──────────────────────────────────────────┤
│          │  KPI-Karten                              │
│ Übersicht│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ Events   │  │Einreich. │ │Ø Bewert. │ │UGC-Anzahl│ │
│ QR-Codes │  └──────────┘ └──────────┘ └──────────┘ │
│ Medien   │                                          │
│ Einstell.│  Letzte Veranstaltungen                  │
│          │  ┌────────────────────────────────────┐  │
│          │  │ Name · Datum · Upload · Bew. · →  │  │
│          │  │ Name · Datum · Upload · Bew. · →  │  │
│          │  └────────────────────────────────────┘  │
│          │  [ + Neue Veranstaltung erstellen ]       │
└──────────┴──────────────────────────────────────────┘
```

---

### Bildschirm 6 — Neue Veranstaltung erstellen

```
┌─────────────────────────────────┬──────────────────┐
│  Veranstaltungsname             │  Mobile Vorschau  │
│  ┌─────────────────────────┐    │  ┌────────────┐  │
│  └─────────────────────────┘    │  │ [Marke]    │  │
│  Datum          Ort*            │  │ Veranst.-  │  │
│  ┌──────────┐   ┌───────────┐   │  │ name       │  │
│  └──────────┘   └───────────┘   │  │            │  │
│  Beschreibung*                  │  │ [Hochladen]│  │
│  ┌─────────────────────────┐    │  │ [Bewerten] │  │
│  └─────────────────────────┘    │  └────────────┘  │
│  Module (V2):                   │                  │
│  ☑ Foto/Video  ☑ Bewertung      │                  │
│  ☐ Kommentar   ☐ Review-Weiterl.│                  │
│                                 │                  │
│  [ Abbrechen ]   [ Erstellen & QR herunterladen ]  │
└─────────────────────────────────┴──────────────────┘
* optional
```

---

### Bildschirm 7 — Gäste-Ablauf (mobil)

**7a. Startseite**

```
┌──────────────────────────────┐
│  [Markenname]                │
│  [Veranstaltungsname]        │
│                              │
│  Teile dein Erlebnis         │
│  und sieh alle Fotos.        │
│                              │
│  [ Starten ]                 │
└──────────────────────────────┘
```

**7b. Einwilligung (Consent)**

```
┌──────────────────────────────┐
│  Zur Datennutzung            │
│  [Datenschutzhinweistext]    │
│                              │
│  ☐ Gelesen und einverstanden │
│                              │
│  [ Weiter ] (inaktiv)        │
└──────────────────────────────┘
```

**7c. Upload**

```
┌──────────────────────────────┐
│  Foto oder Video             │
│  hochladen                   │
│                              │
│  [ + Datei auswählen ]       │
│                              │
│  ████████░░ 74 %             │
│                              │
│  jpg · png · mp4 · mov       │
│  max. 50 MB                  │
└──────────────────────────────┘
```

**7d. Galerie (Sperre geöffnet)**

```
┌──────────────────────────────┐
│  [Markenname] — Galerie      │
│                              │
│  ┌────┐ ┌────┐ ┌────┐        │
│  │ 📷 │ │ 📷 │ │ 📷 │        │
│  └────┘ └────┘ └────┘        │
│  ┌────┐ ┌────┐ ┌────┐        │
│  │ 📷 │ │ 📷 │ │ 📷 │        │
│  └────┘ └────┘ └────┘        │
└──────────────────────────────┘
```

**7e. Bewertung (optional)**

```
┌──────────────────────────────┐
│  Dein Erlebnis bewerten      │
│                              │
│   ★  ★  ★  ★  ★              │
│                              │
│  [ Absenden ]  [ Überspringen]│
└──────────────────────────────┘
```

---

### Bildschirm 8 — Dankeschön / Ergebnis (Gast)

```
┌──────────────────────────────┐
│                              │
│  Vielen Dank! 🎉             │
│  Dein Beitrag wurde zur      │
│  Galerie hinzugefügt.        │
│                              │
│  [ Galerie anzeigen ]        │
│                              │
│  [ Bewertung auf Google ]    │  ← V2
│                              │
└──────────────────────────────┘
```

---

### Bildschirm 9 — Veranstaltungsdetail (Unternehmens-Panel)

```
┌──────────────────────────────────────────────────────┐
│  ← Zurück  [Veranstaltungsname]  [QR] [Link teilen]  │
├───────────────────────┬──────────────────────────────┤
│ Übersicht │ Medien │..│  Einreichungen: 42  Ø: 4,3   │
├───────────────────────┴──────────────────────────────┤
│  Filtern: [Alle ▾]  [Geflaggt]  [ZIP-Export*]        │
│                                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ 📷   │ │ 📷   │ │ 📷   │ │ 📷   │ │ 📷   │      │
│  │[Flag]│ │[Flag]│ │[Flag]│ │[Flag]│ │[Flag]│      │
│  │[↓]   │ │[↓]   │ │[↓]   │ │[↓]   │ │[↓]   │      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
└──────────────────────────────────────────────────────┘
* V2
```
