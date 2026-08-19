import { PLANS } from '@/lib/plans'

/**
 * Die häufigen Fragen der Startseite — als Daten, nicht als Markup.
 *
 * Grund für `lib/` statt eines Abschnitts unter `app/(marketing)/_sections/`: diese Texte haben
 * ZWEI Abnehmer. Sie stehen sichtbar im FAQ-Abschnitt und noch einmal als strukturierte Daten im
 * JSON-LD (`lib/marketing/json-ld.ts`). Suchmaschinen verlangen, dass beides wörtlich
 * übereinstimmt — stünde der Text im Abschnitt und würde für das JSON-LD abgeschrieben, liefe
 * genau das beim ersten Nachbessern auseinander. Eine Quelle, zwei Darstellungen.
 *
 * Antworten sind reiner Text (kein Markup): JSON-LD nimmt hier eine Zeichenkette, und was dort
 * steht, soll dasselbe sein, was der Besucher liest.
 *
 * Was die Zahlen betrifft, gilt dieselbe Trennung wie bei `pricing.ts`: Kontingente kommen aus
 * `lib/plans`, die Worte von hier.
 */
export type FaqItem = {
  /** Stabil — trägt die Sprungmarke und ist der Schlüssel der Tests. */
  id: string
  question: string
  answer: string
}

const free = PLANS.free

/**
 * BEWUSST NICHT beantwortet: „Wo werden die Daten gespeichert?"
 *
 * Es ist die naheliegendste Frage eines deutschen Betriebs — und die einzige, die wir heute nicht
 * beantworten können, ohne ein Rechtsversprechen abzugeben: die Region der Supabase-Instanz ist
 * nicht bestätigt, ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO fehlt noch. Eine
 * ausweichende Antwort wäre an dieser Stelle schlechter als keine. Sobald beides steht, gehört
 * die Frage hierher — dann zusammen mit dem Speicherort im Datenschutz-Abschnitt.
 */
export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'app',
    question: 'Brauchen meine Gäste eine App?',
    answer:
      'Nein. Der QR-Code öffnet eine Seite im Browser — kein Download, kein Konto, kein Passwort. ' +
      'Den Namen geben Gäste freiwillig an; nur im Gästebuch gehört er zum Gruß.',
  },
  {
    id: 'einrichtung',
    question: 'Wie schnell bin ich startklar?',
    answer:
      'Konto anlegen, Kampagne anlegen, QR-Code herunterladen — mehr Schritte gibt es nicht. ' +
      'Ausdrucken oder digital teilen kannst du ihn sofort danach.',
  },
  {
    id: 'preis',
    question: 'Was kostet Momento?',
    answer:
      `Der kostenlose Tarif umfasst ${free.maxActiveEvents} aktive Kampagne mit bis zu ` +
      `${free.maxUploadsPerEvent.toLocaleString('de-DE')} Beiträgen — ohne Kreditkarte. Wer mehr ` +
      `braucht, bekommt ${PLANS.pro.label} in der Einführungsphase persönlich freigeschaltet; ` +
      'einen Kaufknopf gibt es noch nicht.',
  },
  {
    id: 'sichtbarkeit',
    // Die drei Sätze folgen den drei Einwilligungstexten (FLOW_MODE_LABELS): was hier steht, ist
    // wörtlich das, was der Gast vor dem Absenden zu lesen bekommt.
    question: 'Wer sieht die Beiträge meiner Gäste?',
    answer:
      'Das entscheidet die Art der Kampagne. Rückmeldungen einer Feedback-Kampagne gehen nur an ' +
      'dich. In einer Galerie sehen andere Gäste Foto und Beschreibung — den Namen bekommst nur ' +
      'du. Ein Gästebuch ist geschlossen: die Grüße gehen ausschließlich an den Veranstalter.',
  },
  {
    id: 'loeschen',
    question: 'Kann ich einen Beitrag wieder löschen?',
    answer:
      'Ja, jederzeit. Löschen entfernt die Datei aus dem Speicher und den Eintrag aus deiner ' +
      'Liste — nicht nur die Anzeige. Widerruft ein Gast seine Einwilligung, ist das der Weg dafür.',
  },
  {
    id: 'export',
    // Prüft `tests/marketing.test.ts` gegen FLOW_MODE_CAPABILITIES: wird der Export je für das
    // Gästebuch geöffnet, ist dieser Satz falsch und der Test fällt.
    question: 'Komme ich an die Inhalte auch außerhalb des Dashboards?',
    answer:
      'Feedback- und Galerie-Kampagnen lassen sich als CSV herunterladen; die Medien-Links darin ' +
      'sind aus Datenschutzgründen eine Stunde gültig. Das Gästebuch hat keinen Export — die ' +
      'Grüße einer Feier sind keine Tabelle.',
  },
  {
    id: 'cookies',
    question: 'Setzt Momento Cookies oder verfolgt es meine Gäste?',
    answer:
      'Nur was technisch nötig ist: deine Anmeldung im Dashboard und die Sitzung des Gastes ' +
      'während seines Beitrags. Keine Analyse-Skripte, keine Werbe-Cookies — deshalb steht auf ' +
      'dieser Seite auch kein Cookie-Banner.',
  },
]
