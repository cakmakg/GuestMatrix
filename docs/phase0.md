# Phase 0 — Problem & Umfang

## Für wen, welcher Schmerzpunkt?

Primär (Beachhead): Kleine Reiseoperatoren / unabhängige Reiseleiter.
Fast-Follow (mit T2 / Migration `0009` GEBAUT & aktiv): Hotels & Resorts — Kampagnentyp `stay`,
Flow-Modus `feedback`.
Endnutzer: Gäste des jeweiligen Unternehmens.

Schmerzpunkt: Unternehmen können Gästeerfahrungs-Inhalte (Foto/Video) und Feedback
nicht systematisch erfassen. Inhalte bleiben auf den Geräten der Gäste und gehen verloren;
dem Unternehmen fehlen sowohl wiederverwendbare UGC als auch strukturiertes Feedback.

## Core-Loop (einziger Ablauf)

Gast scannt QR-Code in einem emotionalen Moment → landet in der gemeinsamen Galerie der Tour →
lädt Foto/Video hoch (Schlossmechanik: erst beitragen, dann alle sehen) →
optionale 1-Klick-Bewertung. Das Unternehmen sieht Inhalte + Feedback in einem einfachen Dashboard.

## MVP-Umfang (ENTHALTEN)

- Ein Tenant-Typ (Reiseleiter/Operator), multi-tenant-fähige DB (tenantId in jedem Datensatz)
- Veranstaltung/Tour erstellen → QR-Code generieren
- Gast QR → mobiles Web (KEINE native App) → Media-Upload → Galerie anzeigen
- Reziprozitäts-Schlossmechanik
- 1-Klick-Feedback (Bewertung/Emoji)
- Minimales Unternehmens-Dashboard: Veranstaltungsliste, Inhalte anzeigen/herunterladen, Basiszählungen
- Consent-Checkbox + einfaches Moderations-Flag (DSGVO + UGC → nicht verhandelbar)

## NICHT im Umfang (jetzt NICHT — bewusst)

Self-serve-Registrierung, Abrechnung/Abonnements/Pakete, hotel-/resort-spezifische Abläufe,
Loyalty/Belohnungen, erweitertes Analytics-Dashboard, NPS, native App, Mehrsprachigkeit,
Rollen/Mehrbenutzer pro Tenant, KI-Funktionen außer Moderation.

**Aktive Bahnen (Stand T2):** `tourism / tour / gallery` (MVP) UND `tourism / stay / feedback`
(Hotel-Feedback; Migration `0009` erweiterte die CHECKs und ergänzte atomar das B1-Gallery-Audit
`is_gallery_event`, `0010` fügte die ownership-geprüfte RPC `attach_feedback` hinzu).
**Weiterhin deaktiviert (designed-for, not built):** die Sektoren `real_estate` und `event`
(Hochzeit/Momento) sowie der Flow-Modus `guestbook` — als Code vorhanden, per Migration `0006` +
Registry gesperrt. Die oben exkludierte **Self-serve-Registrierung** bleibt konsistent deaktiviert
(die Route `/signup` ist ausgeschaltet); Tenants weist der Betreiber zu. Anleitung zur
(Wieder-)Aktivierung: **`docs/extension-points.md`**.

## Risikoreichste Annahme

„Laden Gäste wirklich Inhalte hoch?" (nicht technisch, sondern verhaltensbasiert)
Validierung: QR-Scan → abgeschlossener Upload-Conversion + Anzahl Inhalte pro Veranstaltung.
Rohschwelle: Bei 3–5 echten Reiseleitern in echten Touren laden ≥ 40 % der Scannenden mindestens 1 Inhalt hoch.
In dieser Phase KEIN Geld, KEINE Skalierungsmetriken (MRR/Retention/Expansion).

## North Star (eingegrenzt)

Bedeutungsvolle Gästeinteraktion pro Tenant und Monat. MVP-Entsprechung: Anzahl abgeschlossener
Uploads pro Veranstaltung.

## KI-Hinweis

Im MVP einzige KI = Moderations-Stub (Nudity/Abuse-Flag). Feedback-Zusammenfassung und
Marketinginhalt aus UGC = Phase-2-Hook; designtechnisch vorbereitet, jetzt KEIN Build.
