# Pensioen Vergelijker — UI + live Allianz-proxy

Vite + React + TypeScript app die direct ingaande uitkeringen (DIZP/DIKP/DIL)
vergelijkt. Allianz kan live tegen de webservice; de overige verzekeraars
(a.s.r., Nationale-Nederlanden, Zwitserleven) draaien op indicatieve mock tot
hun API-contract beschikbaar is.

## Draaien

```bash
npm install
npm run dev
```

## Live tegen Allianz (acceptatie)

1. Kopieer `.env.example` naar `.env` en vul je acc-credentials in:

   ```
   ALLIANZ_ACCEPTATIE_USERNAME=...
   ALLIANZ_ACCEPTATIE_PASSWORD=...
   ```

2. Start (of herstart) `npm run dev`.
3. Zet de omgevingsschakelaar rechtsboven op **Acceptatie**, vink **Allianz** aan
   en klik **Bereken vergelijking**.

De browser roept `/api/vergelijk` aan; de dev-proxy (`src/server/`) doet de
POST met `form-data` server-side naar het acc-endpoint, met je credentials uit
`.env`. Die verlaten de server nooit — ze komen niet in de client-bundel.

### Waarom een proxy?

De Allianz-webservice is niet vanuit de browser aanroepbaar: CORS blokkeert
cross-origin calls, en gebruikersnaam/wachtwoord horen niet in client-code.
De dev-proxy lost beide op.

### Endpoints per omgeving (uit de handleiding v1.4)

| Omgeving | DIZP/DIKP | DIL |
|---|---|---|
| Test | `test-directingaandpensioen.epg-info.nl/api/berekenuitkering` | `.../api/berekenDILuitkering` |
| Acceptatie | `acc-directingaandpensioen.epg-info.nl/api/berekenuitkering` | `.../api/berekenDILuitkering` |
| Productie | `leven.allianz.nl/api/berekenuitkering` | `leven.allianz.nl/api/berekenDILuitkering` |

> Let op: de Postman-bijlage in de handleiding toont een ander host
> (`test-mijnpensioenkomtvrij.dashboard-backend.nl`) dan de URL-tabel. Krijg je
> een DNS-/404-fout, verifieer dan het exacte acc-host bij Allianz.

## Structuur

- `src/domain/` — genormaliseerde types, validatie, productgrenzen (client + server).
- `src/server/` — de server-logica: echte Allianz-call + normalisatie + orchestratie
  (`maakVergelijkHandler`), framework-agnostisch — geen afhankelijkheid van Vite of Vercel.
- `api/vergelijk.ts` — Vercel serverless function; dunne adapter rond `maakVergelijkHandler`.
- `src/adapters/mock.ts` — verzekeraarconfig, endpoints en de mockberekening.
- `src/components/` — Masthead, omgevingsribbon, invoerpaneel, vergelijkstaat.
- `vite.config.ts` — mount de proxy als middleware op `/api/vergelijk` tijdens dev.

## Naar productie (Vercel)

De Vite dev-middleware (`vite.config.ts`) draait alleen tijdens `npm run dev`.
In productie doet `api/vergelijk.ts` hetzelfde werk als Vercel serverless
function — beide roepen dezelfde `maakVergelijkHandler` uit `src/server/handler.ts`
aan, dus de server-logica bestaat maar één keer.

1. Koppel de repo aan een Vercel-project (dashboard → *Import Project*, of
   `vercel link` via de CLI). Vercel detecteert Vite automatisch
   (`npm run build`, output-map `dist`) en de `api/`-map als serverless functions.
2. Zet de Allianz-credentials als environment variables in het Vercel-project
   (Project → Settings → Environment Variables), per Vercel-environment
   (Preview/Production) en per Allianz-omgeving:
   `ALLIANZ_TEST_USERNAME`, `ALLIANZ_TEST_PASSWORD`,
   `ALLIANZ_ACCEPTATIE_USERNAME`, `ALLIANZ_ACCEPTATIE_PASSWORD`,
   `ALLIANZ_PRODUCTIE_USERNAME`, `ALLIANZ_PRODUCTIE_PASSWORD`.
   Deze blijven server-side (serverless function runtime) en komen nooit in de
   client-bundel — dezelfde garantie als bij de dev-proxy.
3. Deploy (`git push` op een gekoppelde branch, of `vercel --prod`).
4. Lokaal testen tegen de serverless function (in plaats van de Vite-middleware)
   kan met `vercel dev`.

### Naar een eigen Node-server

`maakVergelijkHandler(env)` is framework-agnostisch (puur een async functie die
een body ontvangt en een resultaat teruggeeft) — een latere migratie naar een
eigen Express/Node-proces betekent alleen een nieuwe dunne adapter schrijven
(vergelijkbaar met `api/vergelijk.ts` of de middleware in `vite.config.ts`),
niet het herschrijven van de server-logica zelf.

## a.s.r. (ASR DIP) — live koppeling

a.s.r. loopt via het BMS/eBenefits-platform en wijkt sterk af van Allianz:

- **XML** in en uit (`Content-Type: application/xml`), niet JSON/form-data.
- **Authenticatie met een client-certificaat (mTLS)**, geen wachtwoord. Je krijgt
  een PFX-bestand van het eBenefits-team.
- **Geen uitkeringstermijn in de API**; het antwoord is een maandbedrag. De adapter
  rekent dat om naar de gekozen termijn.
- **DIZP (vast, `Variabel=false`) en DIKP (doorbeleggen, `Variabel=true`)** zijn
  gekoppeld. Tijdelijke uitkeringen zijn bewust buiten scope gelaten
  (`LevenslangTijdelijkVerhouding` staat altijd op 1, levenslang).
- a.s.r. kent geen garantiepercentage-schuif zoals Allianz — bij DIKP wordt altijd
  volledig doorbeleggend (`Variabel="true"`) aangeroepen, ongeacht het gekozen
  garantiepercentage in de UI. `Daling` (hoog-laag-patroon) volgt wel uit
  `uitkeringsverloop` ("dalend" → `Daling="true"`).
- **DIL wordt niet ondersteund** door de ASR DIP-stream; a.s.r. verschijnt dan
  automatisch als niet-aanklikbaar in de verzekeraarslijst (`producten` in
  `mock.ts` bevat geen `"DIL"`).

### Instellen

1. Plaats het PFX-certificaat buiten versiebeheer, bijvoorbeeld `./certs/asr-client.pfx`
   (`certs/` en `*.pfx` staan in `.gitignore`).
2. Vul in `.env` aan:

   ```
   ASR_PFX_PATH=./certs/asr-client.pfx
   ASR_PFX_PASSPHRASE=...
   ```

   Op Vercel (geen bestandssysteem) kun je in plaats daarvan `ASR_PFX_BASE64` zetten
   met de base64 van het PFX-bestand.
3. Herstart `npm run dev`, zet de omgeving op **Acceptatie**, kies product **DIZP**,
   vink **a.s.r.** aan en bereken.

### Endpoints

| Omgeving | URL |
|---|---|
| Acceptatie (staging) | `acceptatiebms.mijnpensioenportaal.nl/public/api/processor/execute-v1/ASR%20DIP` |
| Productie | `bms.mijnpensioenportaal.nl/public/api/processor/execute-v1/ASR%20DIP` |

ASR heeft geen apart test-endpoint; `test` valt terug op acceptatie.

### Vast IP op Vercel (whitelisting)

a.s.r. whitelist't op IP-adres. Vercel Functions hebben geen vast uitgaand IP,
dus zonder maatregelen is elk verzoek vanaf een ander adres afkomstig en wordt
het geweigerd. Oplossing: een vaste-IP-proxy zoals [Fixie](https://www.fixie.dev)
(heeft een gratis tier).

- **Lokaal:** niet nodig — je eigen IP is al bij a.s.r. gewhitelist, dus laat
  `FIXIE_URL` leeg. De aanroep gaat dan direct (zie `laadAsrProxy()` in `asr.ts`).
- **Op Vercel:** maak een Fixie-account aan, zet de opgegeven proxy-URL als
  `FIXIE_URL` in de Vercel-projectinstellingen, en laat dát vaste IP whitelisten
  bij a.s.r. De aanroep tunnelt dan via `https-proxy-agent` door die proxy heen;
  de mTLS-handshake met a.s.r. zelf (het certificaat) verandert niet — de proxy
  ziet alleen versleuteld verkeer, geen certificaatgegevens.

### Voorbeeld-XML van a.s.r.

`manuals/2026-01-28 - stream ASR DIP - Example API input.xml` en `...output.xml`
zijn een door a.s.r. aangeleverd, bevestigd input/output-voorbeeld (niet door ons
zelf bedacht). De output-tags (`Status`, `BrutoVerwachtWeer`) matchen exact met
wat `normaliseer()` in `asr.ts` al verwachtte. Het input-voorbeeld bracht wél een
aantal verplichte attributen aan het licht die we eerder misten op `DIPInvoer`
(`RtsDatum`, `TariefDatum`, `DnbBestandDatum`, `KortingEenmaligeKosten`,
`KortingDoorlopendeKosten`, `Daling`, `BerekenPrognose`) en op `DIPKapitaal`
(`Verevend`, `SexeAfhankelijk`) — die zijn inmiddels toegevoegd in `buildAsrXml()`.

### Aannames (te bevestigen bij a.s.r.)

- Het teruggegeven `Bruto*Weer`-bedrag is een **maandbedrag** (op grond van de orde
  van grootte in het voorbeeld). Termijnomrekening en jaarbedrag zijn hierop gebaseerd.
- `RtsDatum`/`TariefDatum`/`DnbBestandDatum` = vandaag (rekendatum voor de actuele
  tabellen); het a.s.r.-voorbeeld gebruikte één vaste datum voor alle drie, maar
  bevestigt niet of dit specifiek "vandaag" moet zijn.
- `KortingEenmaligeKosten=0`, `KortingDoorlopendeKosten=0` (geen kostenkorting
  aangenomen — a.s.r.'s voorbeeld gebruikte 0 resp. 0.05).
- `Daling=false`, `BerekenPrognose=false` (één puntberekening, geen prognosereeks).
- `Verevend=false`, `SexeAfhankelijk=false` op `DIPKapitaal`.
- `BerekeningSoort=OP`, `Fiscaliteit=B` (bruto), `LevenslangTijdelijkVerhouding=1`.
- `GegevensPartner` is in het schema verplicht. Zonder partner sturen we het knooppunt
  mee met `FactorPartnerPensioen=0` en `Bestemming=OP`; met partner `Bestemming=B` en
  factor = overgangspercentage/100.
- Netto wordt afgeleid met het vlaktarief van 59% (ASR levert alleen bruto). Garantierente
  en kosten levert ASR niet — die tonen "—" in de vergelijkstaat.
