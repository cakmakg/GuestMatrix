# Vision — Agentur-Erweiterung (nach dem Pilot)

> Zweck: bewusst **aus dem aktuellen Slice ausgeklammerte** Richtungen festhalten, damit sie nicht
> verloren gehen und nicht versehentlich vorgezogen werden. Nichts hier ist für den Beachhead-Pilot
> gebaut oder freigegeben. Reihenfolge = erst R1 (laden Gäste wirklich hoch?) validieren, dann
> erweitern. Siehe `roadmap-analysis.md` (Risiko R1) und `extension-points.md` (Reaktivierungs-Rezept).

## Kontext: der tour→agency-Remodel (Slice 0016)

Der Beachhead wurde von einzelnen Reiseleiter:innen ("tour") auf **Reiseagenturen** ("agency")
repositioniert — als Kampagnentyp **innerhalb** des `tourism`-Sektors (Sektor unverändert). `agency`
behält den gallery-Flow (Foto/Video + Reciprocity + Galerie) und trägt zusätzlich einen
strukturierten Feedback-Katalog (Reiseerlebnis + Agentur-Service). Migration `0016`, Registry-Eintrag
`tourism.agency`.

Die folgenden Punkte gehören **bewusst NICHT** zu diesem Slice.

## Ausgeklammert (post-pilot)

### 1. Mehr-Nutzer / Mehr-Mandanten je Agentur (C2)

Heute gilt: **ein Tenant = ein Auth-Nutzer** (`tenants.user_id`, provisioniert vom Trigger
`handle_new_user`, `0015`). Eine Agentur hat aber typischerweise mehrere Mitarbeiter:innen
(Reiseleiter:innen, Büro, Leitung), die dieselben Kampagnen sehen/moderieren sollen.

Das braucht eine Mitgliedschafts-Ebene (z. B. `tenant_members(tenant_id, user_id, role)`) plus RLS,
die von `current_tenant_id()` (heute 1:1 über `user_id`) auf eine Mitgliedschafts-Abfrage umgestellt
wird, sowie Einladungs-/Rollen-Flows. Sicherheitskritisch (Tenant-Isolierung) → eigener Slice mit
eigenem RLS-Proof, nicht nebenbei.

### 2. Preise / Tarife

Das Feld `tenants.plan` (`free`/`pro`) und `lib/plans` existieren und begrenzen aktive Kampagnen,
sind aber **sektor-/typ-unabhängig**. Agentur-spezifische Tarifierung (Sitzplätze je Mitarbeiter,
Kontingente je Kampagnentyp, Stripe-Anbindung) ist eigenständig — an R1/Phase 2 gekoppelt
(`roadmap-analysis.md`, Phase 2).

### 3. Marke / Namensgebung

Die gästeseitige Marke kommt aus `tenants.brand_name`; der Plattform-Default ist neutral
(`GuestMatrix`, `lib/brand.ts`). Eine eigene Agentur-Produktmarke, Domain-/Whitelabel-Themes und die
endgültige Benennung der Kampagnentypen (z. B. „Agentur / Reise") sind **kosmetisch** und bewusst
offen — nicht Teil des Remodels.

## Warum jetzt nicht

Der Remodel ist eine **Go-to-Market-Repositionierung**, keine Architektur-Erweiterung: gleicher
Sektor, gleicher Flow, ein neuer Kampagnentyp + Katalog. Die drei Punkte oben sind jeweils ein
eigener vertikaler Slice mit eigener Sicherheits-/Test-Fläche (besonders C2 = Tenant-Isolierung).
Sie werden erst bewertet, wenn der Pilot die Kernannahme (R1) bestätigt hat.
