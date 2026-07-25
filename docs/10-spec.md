# GuestMatrix — Phase-0-Spezifikation

## 1. User Stories

### Persona A: Reiseleiter / Operator (Tenant)

| #   | Story                                                                                                           | Akzeptanzkriterium                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1 | Ich möchte mich im System anmelden, um meine Veranstaltungen verwalten zu können.                               | Gültige Anmeldedaten → Dashboard. Falsche Anmeldedaten → Fehlermeldung, kein Stack-Trace.                                                                       |
| A-2 | Ich möchte eine neue Veranstaltung (Tour) erstellen, um QR-Codes an Gäste verteilen zu können.                  | Formular: Name + Datum (Pflicht). POST → DB-Eintrag mit tenantId. Antwort: eventId + QR-URL.                                                                    |
| A-3 | Ich möchte den QR-Code einer Veranstaltung herunterladen, um ihn vor Ort einsetzen zu können.                   | QR als PNG herunterladbar. Kodierte URL: `/e/[eventId]`.                                                                                                        |
| A-4 | Ich möchte hochgeladene Inhalte einer Veranstaltung einsehen und herunterladen können.                          | Dashboard: Thumbnail-Raster. Jedes Element: Upload-Datum, Moderationsstatus, Download-Button. Nur eigene tenantId-Inhalte sichtbar.                              |
| A-5 | Ich möchte eine Zusammenfassung des Gäste-Feedbacks einsehen können.                                            | Veranstaltungsdetailseite: Durchschnittsbewertung, Gesamtanzahl Feedback, Gesamtanzahl Uploads.                                                                  |
| A-6 | Ich möchte Inhalte mit einem Moderations-Flag markieren können, um unangemessene Inhalte auszublenden.          | „Flag"-Button → `moderationFlag: true`. Geflaggte Inhalte sind in der Gästegalerie unsichtbar. Flag kann aufgehoben werden.                                      |

### Persona B: Gast (Endnutzer, anonym)

| #   | Story                                                                                                                   | Akzeptanzkriterium                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| B-1 | Nach dem Scannen des QR-Codes möchte ich zu einer Startseite weitergeleitet werden, um zu verstehen, was zu tun ist.   | `/e/[eventId]` → Veranstaltungsname + Kurzbeschreibung + CTA. Ungültige eventId → 404.                                                        |
| B-2 | Vor dem Hochladen von Inhalten möchte ich nach meiner Einwilligung gefragt werden.                                     | Consent-Checkbox (Pflicht, kein Voranklicken). Ohne Bestätigung bleibt Upload-Button inaktiv. Zeitstempel der Einwilligung wird in DB gespeichert. |
| B-3 | Ich möchte Fotos oder Videos hochladen können.                                                                          | Akzeptierte Formate: jpg, png, mp4, mov. Max. Größe: 50 MB. Upload-Fortschrittsanzeige vorhanden. Nach Erfolg wird Galerie angezeigt.         |
| B-4 | Nach dem Hochladen von mindestens 1 Inhalt möchte ich die Galerie der Veranstaltung einsehen können (Reziprozitätssperre). | Ohne abgeschlossenen Upload kein Galerie-Zugriff. Nach Upload wird Galerie geöffnet; alle genehmigten Inhalte außer geflaggten sichtbar.   |
| B-5 | Optional kann ich meine Erfahrung mit 1–5 Sternen oder Emojis bewerten.                                                | Bewertungsbildschirm nach dem Upload-Ablauf. Überspringbar. Bewertung als Integer 1–5; wird in `submissions.rating` gespeichert.              |
| B-6 | Ich möchte die Löschung meiner Inhalte beantragen können.                                                               | Bei jedem Inhalt ist eine „Löschen"-Option sichtbar. Löschanfrage → `deletedAt`-Zeitstempel + Mediendatei löschen. (DSGVO-Löschpfad.)        |

### Persona C: System (implizit)

| #   | Verhalten                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1 | Bei jeder neuen Einreichung wird ein `consentAt`-Zeitstempel gespeichert. Ohne Einwilligung wird kein Eintrag erstellt.                                    |
| C-2 | Moderations-Stub: Nach Abschluss des Uploads wird `moderationFlag: false` gesetzt; KI-Integration in Phase 2.                                             |
| C-3 | Alle Datenbankabfragen sind nach `tenantId` und der jeweiligen ID eingegrenzt; tenant-übergreifende Datenlecks sind ausgeschlossen.                         |
| C-4 | Gelöschte Medien: `deletedAt` wird in der DB gesetzt, die Datei wird aus dem Storage entfernt, sie erscheint weder in der Galerie noch im Dashboard.       |

---

## 2. Core-Ablauf — Schritt für Schritt

Der folgende Ablauf ist der **einzige kritische Pfad** von Phase 0. Jeder Schritt ist als Einheit aus UI-Seite → API-Aufruf → DB-Schreibvorgang definiert.

```
[Reiseleiter] Veranstaltung erstellen
─────────────────────────────────────────────────────────────
1.  Reiseleiter → /dashboard → öffnet Formular „Neue Veranstaltung".
2.  Formular abschicken → POST /api/events
      body: { name, date }   [zod validiert]
      Handler: tenantId wird aus der Session gelesen, Eintrag in events-Tabelle geschrieben.
      Antwort: { eventId, qrUrl }
3.  QR-Code wird auf der Seite gerendert; als PNG herunterladbar.
    QR kodiert: https://<domain>/e/[eventId]

[Gast] QR → Upload → Galerie
─────────────────────────────────────────────────────────────
4.  Gast scannt QR-Code mit der Kamera.
    → /e/[eventId]  (Server Component — SSR)
    → GET /api/events/[eventId]/public
      Handler: events-Tabelle wird abgefragt (nach tenantId eingegrenzt).
      Antwort: { eventName, description }  — nur diese Felder für den Gast.
    → Veranstaltungs-Startseite wird gerendert.

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

| Schritt                            | Metrik                       | Phase-0-Schwellenwert         |
| ---------------------------------- | ---------------------------- | ----------------------------- |
| QR-Scan → Seitenaufruf             | Technische Erreichbarkeit    | 99 % Uptime                   |
| Seitenaufruf → Consent-Bestätigung | Consent-Conversion           | gemessen, kein Schwellenwert  |
| Consent → abgeschlossener Upload   | **Hauptverhaltenshypothese** | **≥ 40 %**                    |
| Upload → Bewertung abgegeben       | Optionale Teilnahme          | gemessen, kein Schwellenwert  |

### Definition of Done (pro Feature)

Ein Feature gilt als abgeschlossen, wenn alle folgenden Punkte erfüllt sind:

1. Happy Path funktioniert (E2E-Ablauf abschließbar).
2. Input-Validierung vorhanden (Zod-Schema, in allen Routen).
3. Fehlerfälle behandelt (ungültige eventId, zu große Datei, Netzwerkfehler).
4. Mindestens 1 Test geschrieben (API-Route oder kritisches Utility).
5. Auf Vercel deploybar (Build erfolgreich, Umgebungsvariablen dokumentiert).

### Außerhalb des Umfangs (in dieser Phase nicht gemessen)

MRR, Retention, NPS, Mehrsprachnutzung, Anzahl Nutzer pro Tenant.
