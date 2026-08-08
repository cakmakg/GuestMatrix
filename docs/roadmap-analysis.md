# Roadmap- & Risikoanalyse

> Strategisches Begleitdokument zu den Spezifikationen (`10-spec.md`, `20-architecture.md`,
> `30-requirements.md`) und dem Phasen-Scope (`phase0.md`). Zweck: die Produktvision, den
> aktuellen Zustand und die größten Risiken an EINER Stelle festhalten, damit jede vertikale
> Scheibe (UI → API → DB → zurück) gegen ein bewusstes Ziel gebaut wird — nicht gegen ein
> Bauchgefühl. Lebendes Dokument; bei jeder abgeschlossenen Scheibe aktualisieren.

## 1. Produktvision

QR-basiertes Guest-UGC- & Feedback-Tool für mehrere Branchen (Sektoren). Ein Gast scannt
vor Ort einen QR-Code, gibt Consent, lädt ein Foto/Video hoch **oder** hinterlässt Feedback;
der Betreiber (Reiseleiter, Makler, Event-Veranstalter) erhält moderierbare, DSGVO-konforme
Inhalte, die er weiterverwenden kann.

- **Beachhead:** Tourismus (Touroperatoren / Reiseleiter). Kein Sektor ist privilegiert oder
  Standard — der Beachhead ist eine Go-to-Market-Entscheidung, keine Architektur-Sonderrolle.
- **Mehrmandantenfähig:** Ein Tenant = eine Kundenorganisation mit genau einem Sektor. Der
  Sektor gehört dem **Betreiber** und wird als Code entwickelt (`lib/sectors/<id>/`), nicht
  vom Kunden gewählt.
- **Vertrauensversprechen:** Gästemedien sind personenbezogene Daten. Consent, Moderations-Flag
  und Löschpfad sind Teil der Definition von „fertig", nicht Zusatzfeatures.

## 2. Aktueller Zustand (Stand 2026-08-04)

**Aktive Bahnen:** `tourism / agency / gallery` (MVP, + strukturierter Feedback-Katalog) und
`tourism / stay / feedback` (Hotel-Feedback). Der Beachhead wurde per Remodel (`0016`) von
einzelnen Reiseleiter:innen (`tour`) auf **Reiseagenturen** (`agency`) repositioniert — als
Kampagnentyp im unveränderten `tourism`-Sektor; `agency` behält den gallery-Flow und trägt
zusätzlich Reiseerlebnis-/Agentur-Service-Fragen (Ausklammerungen: `vision.md`). Beide Bahnen sind
durch zwei Schichten garantiert:

1. **DB-CHECK** (`0006` verengt, `0009` erweitert um stay/feedback, `0016` tauscht `tour`→`agency`):
   `tenants.sector = 'tourism'`, `events.campaign_type in ('agency','stay')`,
   `events.flow_mode in ('gallery','feedback')`. Eine Zeile außerhalb dieser Werte kann physisch
   nicht existieren.
2. **Registry** (`lib/sectors/index.ts`): einzige Quelle der Wahrheit für UI, Validierung und
   Gäste-Flow.

**Dormant (designed-for, not built-out):** Sektoren `real_estate` und `event` (Hochzeit/Momento)
sowie Flow-Modus `guestbook`. Als Code vorhanden, per CHECK + Registry gesperrt. Die
(Wieder-)Aktivierung ist als geprüftes Rezept dokumentiert (`extension-points.md`) — das ist der
Selbsttest der Architektur: bleibt das Rezept kurz und zeigt auf vorhandenen Code, sind die
Nahtstellen gut.

**Sicherheits- & Compliance-Substrat (steht):**

- RLS auf jeder Tabelle; Tenant-Isolierung über `current_tenant_id()` (SECURITY DEFINER,
  `search_path=''`). Reziprozität: Gäste sehen die Galerie erst nach eigenem Upload.
- B1-Audit: `public_gallery_select` ist seit `0009` flow-mode-aware (`is_gallery_event`) — private
  Feedback-Kommentare erreichen nie die Gäste-Galerie.
- DSGVO-Löschpfad: Soft-Delete + `media_url`-Nulling (`0011`), Fehlerpfad live nachgewiesen.
- Feedback-Anreicherung: strukturierte `jsonb`-Antworten mit DB-Validierung (`0012/0013`).

## 3. Aktuelle vertikale Scheibe: Self-Service-Registrierung

Bis hierher wies der **Betreiber** Tenants manuell zu; die Route `/signup` war deaktiviert
(`app/_signup/`, `_`-Präfix). Diese Scheibe schaltet die Self-Service-Registrierung für den
Beachhead frei:

- **Marke:** Die gästeseitige Marke kommt **immer** aus `tenants.brand_name` (bei der
  Registrierung erfasst). `lib/brand.ts` liefert nur noch den neutralen Plattform-Default
  `GuestMatrix` als Fallback für Betreiber-/Auth-Seiten — nicht mehr „Momento". Momento bleibt
  als dormantes Event-Modul erhalten.
- **Tenant-Provisionierung per DB-Trigger:** `handle_new_user` (AFTER INSERT auf `auth.users`,
  SECURITY DEFINER, `search_path=''`) legt den Tenant in derselben Transaktion wie der
  Auth-Insert an → atomar, kein verwaister Nutzer, kein Admin-Cleanup. Pflicht-Guard
  `if new.is_anonymous then return new` — Gäste bekommen nie einen Tenant. Sektor fest
  `tourism`, plan `free`; `brand_name` aus `raw_user_meta_data`.
- **E-Mail-Bestätigung:** Code ist vorbereitet (`emailRedirectTo`, `options.data.brand_name`).
  Nach Bestätigung führt der Link zu `/login?message=confirmed` (ein `auth/callback`-Handler
  folgt später). Der Dashboard-Toggle wird separat gesetzt.

## 4. Risikoanalyse

| #   | Risiko                                                     | Wirkung                                          | Gegenmaßnahme                                                                          | Status               |
| --- | ---------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------- |
| R1  | **Verhalten:** Laden Gäste wirklich Inhalte hoch?          | Kernannahme des Produkts                         | QR-Scan→Upload-Conversion messen; ≥40 % bei 3–5 echten Reiseleitern                    | offen (Feldtest)     |
| R2  | **Verwaiste Auth-Nutzer** ohne Tenant                      | Nutzer kann sich anmelden, aber Dashboard bricht | Tenant-Insert im DB-Trigger, atomar mit Auth-Insert; Fehler rollt beides zurück        | geschlossen (`0014`) |
| R3  | **Gäste erhalten Tenant** (anonyme Auth)                   | Rechte-/Datenleck                                | `is_anonymous`-Guard im Trigger; DB-Proof (b)                                          | geschlossen (`0014`) |
| R4  | **E-Mail-Bestätigung fehlkonfiguriert** (Cloud)            | Registrierung bricht oder umgeht Bestätigung     | Toggle + `site_url`/Redirect-Allowlist bewusst gesetzt; Code liefert `emailRedirectTo` | offen (Dashboard)    |
| R5  | **Sektor-Lockdown umgangen** (falscher Sektor gespeichert) | Deaktivierte Bahn wird erreichbar                | CHECK `tenants.sector='tourism'` (`0006`); Trigger setzt fest `tourism`                | geschlossen          |
| R6  | **Privater Feedback-Kommentar leakt** in Gäste-Galerie     | DSGVO-/Vertrauensbruch                           | flow-mode-aware `public_gallery_select` (`is_gallery_event`, `0009`)                   | geschlossen          |
| R7  | **DSGVO-Löschung** entfernt Medien nicht vollständig       | Compliance-Verstoß                               | Soft-Delete + `media_url`-Nulling (`0011`), Fehlerpfad live geprüft                    | geschlossen          |
| R8  | **Dormant-Code driftet** / kompiliert nicht mehr           | Erweiterbarkeit nur auf dem Papier               | breite Typ-Tupel; Reaktivierungs-Rezept + Registry-Tests                               | überwacht            |
| R9  | **Rate-Limit/Enumeration** an Auth-Endpunkten              | Abuse, Account-Enumeration                       | IP-Rate-Limit (Signup 5/h); generische Fehlermeldungen                                 | geschlossen          |
| R10 | **Route-Handler ohne Zod** / `any`                         | Schwache Eingabegrenze                           | absolute Regel: jede Route Zod-validiert, `any` verboten                               | Prozess              |

## 5. Roadmap (Phasen)

- **Phase 0 (Fundament):** Schema + RLS + Consent/Moderation/Löschpfad + eine aktive Bahn.
  Weitgehend abgeschlossen; Sicherheits-Substrat steht.
- **Phase 1 (Beachhead-Go-to-Market):** Self-Service-Registrierung (diese Scheibe),
  E-Mail-Bestätigung produktiv, `auth/callback`-Handler, Onboarding-Politur, Feldtest R1.
- **Phase 2 (Reevaluierung):** API-Schicht (Route Handler vs. separates Backend) neu bewerten;
  Pricing/Stripe an das vorhandene `plan`-Feld anschließen; Moderations-Workflow ausbauen.
- **Phase 3 (Zweiter Sektor):** Erst wenn R1 im Tourismus validiert ist, einen dormanten Sektor
  über das dokumentierte Rezept aktivieren (real_estate oder event) — als Beweis der
  Erweiterbarkeit, nicht als Ablenkung vom Beachhead.

## 6. Offene Entscheidungen

- `auth/callback`-Flow (PKCE-Code-Exchange) statt des vorläufigen `/login?message=confirmed`.
- Produktions-SMTP + E-Mail-Templates (Bestätigung, Passwort-Reset) mit Tenant-Marke.
- Ob `plan` (`free`/`pro`) schon in Phase 1 an eine Kontingent-Grenze gebunden wird.
