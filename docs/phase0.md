# Phase 0 — Problem & Umfang

## Für wen, welcher Schmerzpunkt?

Primär (Beachhead): Kleine Reiseoperatoren / unabhängige Reiseleiter.
Fast-Follow (designtechnisch vorbereitet, jetzt KEIN Build): Hotels & Resorts.
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
