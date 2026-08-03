# GuestMatrix — Spezifikation

> **Multi-Sektor (designed-for):** Das Produkt ist für mehrere Branchen entworfen. Ein
> **Tenant** = eine Kundenorganisation mit genau einem **Sektor** (`tourism`, `real_estate`,
> `event`). Jeder Sektor enthält einen oder mehrere **Kampagnentypen**, die den **Flow-Modus**
> des Gäste-Ablaufs bestimmen (`gallery`, `feedback` oder `guestbook`). Kein Sektor ist
> Standard. Details in Abschnitt 0. Sektoren gehören dem Betreiber und liegen je Sektor in
> einem eigenen Ordner unter `lib/sectors/<id>/`; der Kunde bekommt einen Sektor zugewiesen
> und kann keinen anlegen.
>
> **Aktiver Umfang (Stand T2):** Gebaut **und aktiv** sind `tourism / tour / gallery` (MVP) UND
> `tourism / stay / feedback` (Hotel-Feedback; seit Migration `0009`). Die übrigen Zeilen in
> Abschnitt 0 sind **designed-for, nicht aktiv**: als Code vorhanden, aber per Migration `0006` +
> Registry deaktiviert (Sektoren `real_estate`/`event`, Flow-Modus `guestbook`). Reifegrad-Details:
> Abschnitt **0.1**; (Wieder-)Aktivierung: **`docs/extension-points.md`**.

## 0. Sektoren, Kampagnentypen & Flow-Modi

| Sektor        | Kampagnentyp               | Flow-Modus                    | Gäste-Ablauf                                           |
| ------------- | -------------------------- | ----------------------------- | ------------------------------------------------------ |
| `tourism`     | Tour (`tour`)              | `gallery`                     | Foto/Video-Upload + Galerie + Reziprozität + Bewertung |
| `tourism`     | Hotel/Aufenthalt (`stay`)  | `feedback`                    | Bewertung + Kommentar (Medien optional)                |
| `real_estate` | Immobilie (`property`)     | `gallery` **oder** `feedback` | vom Operator je Kampagne wählbar                       |
| `event`       | Hochzeit/Event (`wedding`) | `gallery`                     | wie Tour                                               |

- **`gallery`:** Medium Pflicht · öffentliche Galerie · Reziprozitätssperre · optionale Bewertung.
- **`feedback`:** Medium optional · keine Galerie/Reziprozität · Bewertung + Kommentar, privat an den Tenant.
- **`guestbook`:** privates Gästebuch (Name + Glückwunsch + optionale Medien), nur für den Veranstalter sichtbar — keine Galerie/Reziprozität/Bewertung.
- Neuer Sektor = neuer Ordner unter `lib/sectors/<id>/` + Registry-Eintrag + Wert in der CHECK-Liste der Migration.

> **Hinweis zur Tabelle:** Die Zeile `event` / `wedding` läuft im Modus **`guestbook`**
> (privates Gästebuch, gemäß Architektur `20-architecture.md`) — nicht `gallery`. Eine
> geteilte Galerie / Live-Fotowand ist als späterer `gallery`-Modus vorgesehen.

### 0.1 Umfang & Reifegrad — Built vs. Designed-for

Phasen-Label wie in `30-requirements.md`: **MVP** = Phase 0 · **Deaktiviert** = als Code
vorhanden, per Migration `0006` + Registry ausgeschaltet (designed-for).

| Sektor / Kampagnentyp / Modus     | Reifegrad       | Status                                                                                          |
| --------------------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `tourism` / `tour` / `gallery`    | **MVP — aktiv** | Einzige aktive Validierungsbahn der Phase 0.                                                    |
| `tourism` / `stay` / `feedback`   | **Aktiv (T2)**  | Hotel-Feedback; via `0009` geöffnet (B1-Audit `is_gallery_event`) + `0010` (`attach_feedback`). |
| `real_estate` / `property`        | **Deaktiviert** | `gallery`/`feedback`; Code vorhanden, nicht aktiv.                                              |
| `event` / `wedding` / `guestbook` | **Deaktiviert** | Momento-Gästebuch; Code vorhanden, nicht aktiv.                                                 |

Die DB kann deaktivierte Werte nicht speichern (CHECK aus `0006`, um stay/feedback erweitert in
`0009`). **Aktiv** abgedeckt sind `tour`/`gallery` (Stories B-3…B-5) UND `stay`/`feedback` (Hotel;
Story B-7); nur `guestbook`-Stories beschreiben noch deaktivierte Funktionen. Schritt-für-Schritt
zur (Wieder-)Aktivierung: **`docs/extension-points.md`**.

## 1. User Stories

### Persona A: Tenant (Kundenorganisation — z. B. Reiseleiter, Makler, Event-Veranstalter)

| #   | Story                                                                                                           | Akzeptanzkriterium                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1 | Ich möchte mich im System anmelden, um meine Veranstaltungen verwalten zu können.                               | Gültige Anmeldedaten → Dashboard. Falsche Anmeldedaten → Fehlermeldung, kein Stack-Trace.                                                                                                       |
| A-0 | Ich möchte meine zugewiesene Branche (Sektor) einsehen, damit ich weiß, welche Kampagnentypen ich anlegen kann. | Einstellungen zeigt die vom Betreiber zugewiesene Branche **schreibgeschützt** (aus `tenants.sector`) samt verfügbarer Kampagnentypen. Kunden können keinen Sektor anlegen oder ändern.         |
| A-2 | Ich möchte eine neue Kampagne erstellen, um QR-Codes an Gäste verteilen zu können.                              | Formular: Kampagnentyp (nach Sektor) + Name + Datum (Pflicht); bei Immobilien zusätzlich Galerie/Feedback. POST → DB-Eintrag mit tenantId, campaign_type, flow_mode. Antwort: eventId + QR-URL. |
| A-3 | Ich möchte den QR-Code einer Kampagne herunterladen, um ihn vor Ort einsetzen zu können.                        | QR als PNG herunterladbar. Kodierte URL: `/e/[eventId]`.                                                                                                                                        |
| A-4 | Ich möchte hochgeladene Inhalte bzw. Feedback einer Kampagne einsehen können.                                   | `gallery`-Modus: Thumbnail-Raster mit Moderationsstatus. `feedback`-Modus: Liste aus Bewertung + Kommentar. Nur eigene tenantId-Inhalte sichtbar.                                               |
| A-5 | Ich möchte eine Zusammenfassung des Gäste-Feedbacks einsehen können.                                            | Kampagnendetailseite: Durchschnittsbewertung, Anzahl Beiträge/Feedback, Anzahl Kommentare.                                                                                                      |
| A-6 | Ich möchte Inhalte mit einem Moderations-Flag markieren können, um unangemessene Inhalte auszublenden.          | „Flag"-Button → `moderationFlag: true`. Geflaggte Inhalte sind in der Gästegalerie unsichtbar. Flag kann aufgehoben werden.                                                                     |
| A-7 | Ich möchte Kampagnen archivieren / reaktivieren, um die Anzahl aktiver Kampagnen zu steuern.                    | Toggle setzt/entfernt `archived_at`. Übersicht zeigt „Aktive Kampagnen" (= `archived_at is null`).                                                                                              |

### Persona B: Gast (Endnutzer, anonym)

> Der Ablauf richtet sich nach dem `flow_mode` der Kampagne. **B-3 bis B-5** gelten im
> `gallery`-Modus (Tour, Hochzeit); **B-7** ist der `feedback`-Modus (Hotel-Aufenthalt,
> Immobilien-Besichtigung). B-1, B-2 und B-6 gelten in beiden Modi.

| #   | Story                                                                                                                | Akzeptanzkriterium                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B-1 | Nach dem Scannen des QR-Codes möchte ich zu einer Startseite weitergeleitet werden, um zu verstehen, was zu tun ist. | `/e/[eventId]` → Kampagnenname + Kurzbeschreibung + CTA (Text je nach Kampagnentyp). Ungültige eventId → 404.                                          |
| B-2 | Vor dem Beitrag möchte ich nach meiner Einwilligung gefragt werden.                                                  | Consent-Checkbox (Pflicht, kein Voranklicken). Ohne Bestätigung bleibt der Weiter-Button inaktiv. Zeitstempel der Einwilligung wird in DB gespeichert. |
| B-3 | (`gallery`) Ich möchte Fotos oder Videos hochladen können.                                                           | Akzeptierte Formate: jpg, png, mp4, mov. Max. Größe: 50 MB. Upload-Fortschrittsanzeige vorhanden. Nach Erfolg wird Galerie angezeigt.                  |
| B-4 | (`gallery`) Nach dem Hochladen von mindestens 1 Inhalt möchte ich die Galerie einsehen können (Reziprozitätssperre). | Ohne abgeschlossenen Upload kein Galerie-Zugriff. Nach Upload wird Galerie geöffnet; alle genehmigten Inhalte außer geflaggten sichtbar.               |
| B-5 | (`gallery`) Optional kann ich meine Erfahrung mit 1–5 Sternen bewerten.                                              | Bewertungsbildschirm nach dem Upload-Ablauf. Überspringbar. Bewertung als Integer 1–5; wird in `submissions.rating` gespeichert.                       |
| B-6 | Ich möchte die Löschung meiner Inhalte beantragen können.                                                            | Bei jedem Beitrag ist eine „Löschen"-Option sichtbar. Löschanfrage → `deletedAt`-Zeitstempel + ggf. Mediendatei löschen. (DSGVO-Löschpfad.)            |
| B-7 | (`feedback`) Ich möchte eine Bewertung und/oder einen Kommentar abgeben, optional mit Foto/Video.                    | Mindestens Bewertung **oder** Kommentar erforderlich. Medium optional. Keine Galerie. `consent_at` serverseitig; `rating`/`comment` gespeichert.       |

### Persona C: System (implizit)

| #   | Verhalten                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1 | Bei jeder neuen Einreichung wird ein `consentAt`-Zeitstempel gespeichert. Ohne Einwilligung wird kein Eintrag erstellt.                              |
| C-2 | Moderations-Stub: Nach Abschluss des Uploads wird `moderationFlag: false` gesetzt; KI-Integration in Phase 2.                                        |
| C-3 | Alle Datenbankabfragen sind nach `tenantId` und der jeweiligen ID eingegrenzt; tenant-übergreifende Datenlecks sind ausgeschlossen.                  |
| C-4 | Gelöschte Medien: `deletedAt` wird in der DB gesetzt, die Datei wird aus dem Storage entfernt, sie erscheint weder in der Galerie noch im Dashboard. |

---

## 2. Core-Ablauf — Schritt für Schritt

Der folgende Ablauf ist der **einzige kritische Pfad** von Phase 0. Jeder Schritt ist als Einheit aus UI-Seite → API-Aufruf → DB-Schreibvorgang definiert.

```
[Reiseleiter] Veranstaltung erstellen
─────────────────────────────────────────────────────────────
1.  Reiseleiter → /dashboard → öffnet Formular „Neue Veranstaltung".
2.  Formular abschicken → POST /api/events
      body: { name, date, campaignType, flowMode? }   [zod validiert]
      Handler: tenantId aus der Session; campaignType muss zum Sektor passen
      (isValidCampaignForSector), flowMode via resolveFlowMode. Eintrag in events-Tabelle.
      Antwort: { eventId, qrUrl }
3.  QR-Code wird auf der Seite gerendert; als PNG herunterladbar.
    QR kodiert: https://<domain>/e/[eventId]

[Gast] QR → Upload → Galerie
─────────────────────────────────────────────────────────────
4.  Gast scannt QR-Code mit der Kamera.
    → /e/[eventId]  (Server Component — SSR)
    → GET /api/events/[eventId]/public
      Handler: events-Tabelle wird abgefragt.
      Antwort: { name, description, brandName, campaignType, flowMode, labels }.
    → Kampagnen-Startseite wird gerendert; der Client wählt anhand von flowMode
      den Galerie- oder den Feedback-Ablauf (siehe unten).

5.  Gast drückt auf „Hochladen".
    → Consent-Modal öffnet sich.
    → Checkbox wird angehakt (Pflicht).
    → „Weiter" → anonyme Sitzung wird erstellt (Supabase anonymous auth).
      POST /api/sessions  →  { sessionToken, eventId }

6.  Dateiauswahl-Bildschirm öffnet sich.
    → Gast wählt Datei aus (jpg/png/mp4/mov, ≤50 MB).
    → Client → POST /api/submissions/presign
        body: { eventId, fileName, fileType }  [zod validiert]
        Handler: Session wird verifiziert, Presigned-Upload-URL wird generiert.
        Antwort: { presignedUrl, submissionId }
    → Client lädt Datei direkt in den Storage hoch (via Presigned URL).
    → Upload abgeschlossen → PATCH /api/submissions/[submissionId]/confirm
        Handler: Submission-Eintrag wird aktualisiert:
          { uploadedAt: now, moderationFlag: false, consentAt: <Zeitstempel> }

7.  Erfolgsbildschirm → „Galerie anzeigen"-Button wird aktiv.
    → GET /api/events/[eventId]/gallery
        Handler: submissions-Tabelle wird abgefragt:
          Filter: { eventId, tenantId, moderationFlag: false, deletedAt: null }
        Antwort: [ { submissionId, mediaUrl, uploadedAt } ]
    → Galerie wird gerendert.

8.  [Optional] Bewertungsbildschirm.
    → Gast wählt 1–5 oder drückt „Überspringen".
    → Bei Auswahl: PATCH /api/submissions/[submissionId]/rate
        body: { rating: 1..5 }  [zod validiert]
        Handler: submission.rating wird aktualisiert.

[Gast] Feedback-Modus (Alternative zu Schritt 5–8, wenn flow_mode = feedback)
─────────────────────────────────────────────────────────────
F1. Nach Consent (Schritt 5) erscheint der Feedback-Bildschirm:
    Bewertung (1–5, optional) + Kommentar (optional) + optionales Foto/Video.
F2. Absenden → POST /api/events/[eventId]/feedback
      body: { rating?, comment?, submissionId? }   [zod validiert; rating ODER comment ODER Medium]
      - ohne Medium: neue submission (file_type NULL, consent_at + uploaded_at serverseitig).
      - mit Medium: zuerst presign → PUT → confirm, dann rating/comment via submissionId anhängen.
    → Dankeschön-Bildschirm. Keine Galerie, keine Reziprozität.

[Reiseleiter] Dashboard
─────────────────────────────────────────────────────────────
9.  Reiseleiter → /dashboard/events/[eventId] → Veranstaltungsdetailseite.
    → GET /api/events/[eventId]/submissions  (Authentifizierung erforderlich)
        Filter: { tenantId }  — Tenant-Isolierung.
        Antwort: alle Submissions (inkl. geflaggter, deletedAt: null).
    → Thumbnail-Raster + Statistiken: Anzahl Uploads, Durchschnittsbewertung.

10. Reiseleiter flaggt Inhalt.
    → PATCH /api/submissions/[submissionId]/moderate
        body: { moderationFlag: true | false }  [zod validiert]
        Handler: tenantId wird verifiziert, Flag wird aktualisiert.

11. Gast beantragt Löschung.
    → DELETE /api/submissions/[submissionId]
        Handler: tenantId oder Session wird verifiziert.
        deletedAt wird gesetzt + Datei aus Storage gelöscht.
```

---

## 3. Messbare Erfolgskriterien

### Primärmetrik (North Star)

**Anzahl abgeschlossener Uploads pro Veranstaltung.**
Ziel: Durchschnittlich ≥ 5 Uploads pro Veranstaltung in Pilottouren.

### Conversion-Trichter (Validierungsmetriken)

| Schritt                            | Metrik                       | Phase-0-Schwellenwert        |
| ---------------------------------- | ---------------------------- | ---------------------------- |
| QR-Scan → Seitenaufruf             | Technische Erreichbarkeit    | 99 % Uptime                  |
| Seitenaufruf → Consent-Bestätigung | Consent-Conversion           | gemessen, kein Schwellenwert |
| Consent → abgeschlossener Upload   | **Hauptverhaltenshypothese** | **≥ 40 %**                   |
| Upload → Bewertung abgegeben       | Optionale Teilnahme          | gemessen, kein Schwellenwert |

### Definition of Done (pro Feature)

Ein Feature gilt als abgeschlossen, wenn alle folgenden Punkte erfüllt sind:

1. Happy Path funktioniert (E2E-Ablauf abschließbar).
2. Input-Validierung vorhanden (Zod-Schema, in allen Routen).
3. Fehlerfälle behandelt (ungültige eventId, zu große Datei, Netzwerkfehler).
4. Mindestens 1 Test geschrieben (API-Route oder kritisches Utility).
5. Auf Vercel deploybar (Build erfolgreich, Umgebungsvariablen dokumentiert).

### Außerhalb des Umfangs (in dieser Phase nicht gemessen)

MRR, Retention, NPS, Mehrsprachnutzung, Anzahl Nutzer pro Tenant.
