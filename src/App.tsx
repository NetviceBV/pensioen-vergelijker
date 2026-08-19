import { useEffect, useMemo, useState } from "react";
import type {
  Omgeving,
  Product,
  Rol,
  VergelijkResultaat,
  VergelijkVerzoek,
} from "./domain/types";
import { grenzenVoor } from "./domain/grenzen";
import { valideer } from "./domain/valideer";
import { verzekeraarsVoor, alleVerzekeraars, relevanteVelden } from "./adapters/registry";
import { vergelijk } from "./lib/vergelijk";
import { Masthead } from "./components/Masthead";
import { EnvRibbon } from "./components/EnvRibbon";
import { InvoerPaneel, type FormState } from "./components/InvoerPaneel";
import { Resultaat } from "./components/Resultaat";

export default function App() {
  // TIJDELIJK: omgevingswissel verborgen — achter de schermen altijd acceptatie.
  // Later weer terugzetten naar useState<Omgeving> + de switcher in Masthead.
  const omgeving: Omgeving = "acceptatie";
  const [product, setProduct] = useState<Product>("DIZP");
  const [rol, setRol] = useState<Rol>("adviseur");
  const [partnerAan, setPartnerAan] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<string[]>([
    "allianz",
    "asr",
    "nn",
    "zwitserleven",
  ]);
  const [resultaten, setResultaten] = useState<VergelijkResultaat[] | null>(
    null,
  );
  const [bezig, setBezig] = useState(false);

  const [form, setForm] = useState<FormState>({
    geslachtDeelnemer: "man",
    geboorteDeelnemer: "1958-06-01",
    geslachtPartner: "vrouw",
    geboortePartner: "1960-03-01",
    kapitaal: 125000,
    termijn: "maand",
    ingangsdatum: "2026-09-01",
    garantiepercentage: 100,
    scenario: "verwacht",
    uitkeringsverloop: undefined,
    hoogLaagDuur: "",
    overgang: 70,
    partnerpensioen: 70,
    einddatum: "",
  });

  const beschikbaar = verzekeraarsVoor(product);
  const nietBeschikbaar = alleVerzekeraars().filter(
    (v) => !v.producten.includes(product),
  );
  // Alleen de daadwerkelijk bruikbare selectie: geselecteerd én beschikbaar voor
  // dit product. Bepaalt zowel welke velden zichtbaar zijn (relevanteVelden) als
  // welke verzekeraar-specifieke validatieregels gelden (valideer()).
  const actieveIds = useMemo(
    () => geselecteerd.filter((id) => beschikbaar.some((v) => v.id === id)),
    [geselecteerd, beschikbaar],
  );
  const relevant = useMemo(
    () => relevanteVelden(product, actieveIds),
    [product, actieveIds],
  );

  const verzoek: VergelijkVerzoek = useMemo(
    () => ({
      product,
      rol,
      deelnemer: {
        geslacht: form.geslachtDeelnemer,
        geboortedatum: form.geboorteDeelnemer,
      },
      partner: partnerAan
        ? {
            geslacht: form.geslachtPartner,
            geboortedatum: form.geboortePartner,
            overgangspercentage: form.overgang,
            partnerpensioenPercentage: form.partnerpensioen,
          }
        : undefined,
      kapitaal: Number(form.kapitaal),
      uitkeringstermijn: form.termijn,
      ingangsdatum: form.ingangsdatum,
      garantiepercentage: form.garantiepercentage,
      hoogLaagDuur:
        form.hoogLaagDuur === "" ? undefined : Number(form.hoogLaagDuur),
      scenario: form.scenario,
      uitkeringsverloop: form.uitkeringsverloop,
      einddatum: form.einddatum || undefined,
    }),
    [form, product, rol, partnerAan],
  );

  const problemen = useMemo(
    () => valideer(verzoek, grenzenVoor(rol), actieveIds),
    [verzoek, rol, actieveIds],
  );
  const heeftErrors = problemen.some((p) => p.niveau === "error");

  async function bereken() {
    if (heeftErrors || geselecteerd.length === 0) return;
    setBezig(true);
    const res = await vergelijk(verzoek, omgeving, actieveIds);
    setResultaten(res);
    setBezig(false);
  }

  useEffect(() => {
    void bereken(); /* eslint-disable-next-line */
  }, []);
  useEffect(() => {
    setResultaten(null);
  }, [product]);

  return (
    <div>
      <Masthead omgeving={omgeving} onOmgeving={() => {}} />
      <EnvRibbon omgeving={omgeving} />
      <main className="wrap">
        <InvoerPaneel
          product={product}
          setProduct={setProduct}
          rol={rol}
          setRol={setRol}
          partnerAan={partnerAan}
          setPartnerAan={setPartnerAan}
          form={form}
          setForm={setForm}
          beschikbaar={beschikbaar}
          nietBeschikbaar={nietBeschikbaar}
          geselecteerd={geselecteerd}
          setGeselecteerd={setGeselecteerd}
          relevant={relevant}
          problemen={problemen}
          bezig={bezig}
          onBereken={bereken}
        />
        <section>
          <Resultaat
            resultaten={resultaten}
            bezig={bezig}
            product={product}
            termijn={form.termijn}
            omgeving={omgeving}
          />
        </section>
      </main>
    </div>
  );
}
