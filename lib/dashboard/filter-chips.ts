/**
 * Aktive Filter als abnehmbare Chips.
 *
 * Die Filterformulare reisen als `searchParams` (GET, kein Client-JavaScript). Auf dem Desktop
 * durfte das Formular offen daneben stehen; auf dem Telefon füllte es den ersten Bildschirm,
 * bevor überhaupt eine Zeile Inhalt kam. Die Chips drehen das um: sichtbar ist nur noch, was
 * WIRKLICH gesetzt ist — und jeder Chip trägt seinen eigenen Ausschalter.
 *
 * Rein (keine DB, kein React): die Seite kennt die Namen ihrer Filter, diese Funktionen bauen
 * daraus Adressen.
 */

export type FilterChip = {
  /** Formularfeld, das dieser Chip repräsentiert — zugleich der React-key. */
  key: string
  /** Was der Chip anzeigt, z. B. „Bewertung: kritisch". */
  label: string
  /** Ziel des „×": dieselbe Ansicht ohne genau diesen Filter. */
  href: string
}

/**
 * Adresse derselben Seite ohne den einen Filter.
 *
 * Nur gesetzte Werte wandern in die Query; ein Filter auf seinem Standard („all", „recent")
 * gehört nicht in die Adresse, sonst trüge jede URL den vollständigen Zustand mit sich herum und
 * ließe sich nicht mehr vorlesen. Der Aufrufer entscheidet, was „gesetzt" heißt, indem er
 * Standardwerte gar nicht erst übergibt (`undefined`).
 */
export function hrefWithout(
  basePath: string,
  active: Readonly<Record<string, string | undefined>>,
  dropKey: string,
): string {
  return hrefWith(basePath, active, { [dropKey]: undefined })
}

/**
 * Dieselbe Seite mit geänderten Werten — der Weg für Sortier-Überschriften.
 *
 * Der Grund, warum das nicht einfach ein `?sort=…` am Pfad ist: die Adresse trägt bereits die
 * Filter, und ein Klick auf eine Spaltenüberschrift darf keinen davon abwerfen. Umgekehrt genauso
 * wichtig — `undefined` im Patch ENTFERNT einen Wert, darauf setzt `hrefWithout` auf.
 *
 * Ein überschriebener Schlüssel behält seine Position in der Query (Objekt-Spreizung), damit
 * dieselbe Ansicht immer dieselbe Adresse hat und nicht je nach Klickweg anders aussieht.
 */
export function hrefWith(
  basePath: string,
  active: Readonly<Record<string, string | undefined>>,
  patch: Readonly<Record<string, string | undefined>>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...active, ...patch })) {
    if (value !== undefined && value !== '') params.set(key, value)
  }
  const query = params.toString()
  return query === '' ? basePath : `${basePath}?${query}`
}

/**
 * Baut die Chipliste aus den gesetzten Filtern.
 *
 * `labels` bildet jeden Filterwert auf seinen Anzeigetext ab; fehlt ein Eintrag, wird der rohe
 * Wert gezeigt statt der Chip verschluckt — ein unsichtbarer aktiver Filter ist schlimmer als
 * ein hässlicher Chip, weil die Liste dann ohne erkennbaren Grund unvollständig aussieht.
 */
export function buildFilterChips(
  basePath: string,
  active: Readonly<Record<string, string | undefined>>,
  labels: Readonly<Record<string, string>>,
  /**
   * Parameter, die in der Adresse MITREISEN, aber keinen Chip bekommen — die Sortierung, seit sie
   * ihren Zustand in der Tabellenkopfzeile selbst zeigt. Sie müssen in `active` bleiben, nicht
   * weggelassen werden: jeder Chip-href wird aus `active` gebaut, und einen Filter abzuwerfen darf
   * nicht die Sortierung zurücksetzen.
   */
  silent: readonly string[] = [],
): FilterChip[] {
  return Object.entries(active)
    .filter(([key, value]) => value !== undefined && value !== '' && !silent.includes(key))
    .map(([key, value]) => ({
      key,
      label: labels[`${key}:${value}`] ?? `${key}: ${value}`,
      href: hrefWithout(basePath, active, key),
    }))
}
