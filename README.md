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
