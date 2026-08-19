import type { Product, Rol, Uitkeringstermijn, VeldKey, VergelijkVerzoek } from "../domain/types";
import type { Probleem } from "../domain/valideer";
import type { VerzekeraarConfig } from "../adapters/types";
import { Field } from "./ui";

export interface FormState {
  geslachtDeelnemer: "man" | "vrouw";
  geboorteDeelnemer: string;
  geslachtPartner: "man" | "vrouw";
  geboortePartner: string;
  kapitaal: number | string;
  termijn: Uitkeringstermijn;
  ingangsdatum: string;
  garantiepercentage: number;
  scenario: VergelijkVerzoek["scenario"];
  uitkeringsverloop: VergelijkVerzoek["uitkeringsverloop"];
  hoogLaagDuur: string;
  overgang: number;
  partnerpensioen: number;
  einddatum: string;
}

interface Props {
  product: Product; setProduct: (p: Product) => void;
  rol: Rol; setRol: (r: Rol) => void;
  partnerAan: boolean; setPartnerAan: (b: boolean) => void;
  form: FormState; setForm: (f: FormState) => void;
  beschikbaar: VerzekeraarConfig[];
  nietBeschikbaar: VerzekeraarConfig[];
  geselecteerd: string[]; setGeselecteerd: (s: string[]) => void;
  // Unie van optionele velden die de geselecteerde (en beschikbare) verzekeraars
  // gebruiken voor het huidige product — bepaalt welke productspecifieke velden
  // hieronder zichtbaar zijn. Zie adapters/registry.ts#relevanteVelden.
  relevant: Set<VeldKey>;
  problemen: Probleem[];
  bezig: boolean;
  onBereken: () => void;
}

export function InvoerPaneel(p: Props) {
  const { form } = p;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => p.setForm({ ...form, [k]: v });
  const errors = p.problemen.filter((x) => x.niveau === "error");
  const warnings = p.problemen.filter((x) => x.niveau === "warning");

  return (
    <aside className="panel panel-pad">
      <div className="section">
        <div className="section-head eyebrow">Product</div>
        <div className="tabs" role="group" aria-label="Product">
          {(["DIZP", "DIKP", "DIL"] as Product[]).map((k) => (
            <button key={k} aria-pressed={k === p.product} onClick={() => p.setProduct(k)}>{k}</button>
          ))}
        </div>
        <div className="hint">
          {p.product === "DIZP" && "Direct ingaand zeker pensioen — vaste uitkering, garantie 100%."}
          {p.product === "DIKP" && "Direct ingaand keuzepensioen — doorbeleggen in de uitkeringsfase."}
          {p.product === "DIL" && "Direct ingaande lijfrente — levenslang of tijdelijk."}
        </div>
      </div>

      <div className="section">
        <div className="section-head eyebrow">Verzekeraars</div>
        {p.beschikbaar.map((v) => (
          <label key={v.id} className="check-row">
            <span className="check-name">
              {v.naam}
              {v.demo && <span className="tag">demo</span>}
            </span>
            <input type="checkbox" checked={p.geselecteerd.includes(v.id)}
              onChange={(e) => p.setGeselecteerd(e.target.checked ? [...p.geselecteerd, v.id] : p.geselecteerd.filter((x) => x !== v.id))} />
          </label>
        ))}
        {p.nietBeschikbaar.map((v) => (
          <div key={v.id} className="unavailable">{v.naam} — geen {p.product}</div>
        ))}
      </div>

      <div className="section">
        <div className="section-head eyebrow">Advies of Execution Only</div>
        <div className="tabs" role="group" aria-label="Rol">
          <button aria-pressed={p.rol === "adviseur"} onClick={() => p.setRol("adviseur")}>Adviseur</button>
          <button aria-pressed={p.rol === "eo"} onClick={() => p.setRol("eo")}>Execution Only</button>
        </div>
      </div>

      <div className="section">
        <div className="section-head eyebrow">Deelnemer</div>
        <div className="grid2">
          <Field label="Geslacht">
            <select className="control" value={form.geslachtDeelnemer} onChange={(e) => set("geslachtDeelnemer", e.target.value as "man" | "vrouw")}>
              <option value="man">man</option><option value="vrouw">vrouw</option>
            </select>
          </Field>
          <Field label="Geboortedatum">
            <input type="date" className="control" value={form.geboorteDeelnemer} onChange={(e) => set("geboorteDeelnemer", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="section">
        <div className="section-head eyebrow">Uitkering</div>
        <div className="grid2" style={{ marginBottom: 13 }}>
          <Field label="Kapitaal (€)">
            <input type="number" className="control" value={form.kapitaal} onChange={(e) => set("kapitaal", e.target.value)} />
          </Field>
          <Field label="Ingangsdatum">
            <input type="date" className="control" value={form.ingangsdatum} onChange={(e) => set("ingangsdatum", e.target.value)} />
          </Field>
        </div>
        <Field label="Uitkeringstermijn">
          <select className="control" value={form.termijn} onChange={(e) => set("termijn", e.target.value as Uitkeringstermijn)}>
            <option value="maand">maand</option><option value="kwartaal">kwartaal</option>
            <option value="halfjaar">halfjaar</option><option value="jaar">jaar</option>
          </select>
        </Field>

        {p.product === "DIZP" && p.relevant.has("hoogLaagDuur") && (
          <div style={{ marginTop: 13 }}>
            <Field label="Hoog/laag-duur in jaren (optioneel)">
              <input type="number" className="control" placeholder="5 t/m 10" value={form.hoogLaagDuur} onChange={(e) => set("hoogLaagDuur", e.target.value)} />
            </Field>
          </div>
        )}
        {p.product === "DIKP" && (
          <>
            <div style={{ marginTop: 15 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--slate)" }}>Garantiepercentage: {form.garantiepercentage}%</label>
              <input type="range" min={0} max={100} value={form.garantiepercentage} onChange={(e) => set("garantiepercentage", Number(e.target.value))} style={{ marginTop: 8 }} />
            </div>
            {p.relevant.has("scenario") && (
              <div style={{ marginTop: 13 }}>
                <Field label="Scenario">
                  <select className="control" value={form.scenario} onChange={(e) => set("scenario", e.target.value as FormState["scenario"])}>
                    <option value="verwacht">verwacht</option><option value="pessimistisch">pessimistisch</option>
                    <option value="optimistisch">optimistisch</option><option value="historisch">historisch</option>
                  </select>
                </Field>
              </div>
            )}
            {p.relevant.has("uitkeringsverloop") && (
              <div style={{ marginTop: 13 }}>
                <Field label="Uitkeringsverloop">
                  <select className="control" value={form.uitkeringsverloop ?? ""} onChange={(e) => set("uitkeringsverloop", (e.target.value || undefined) as FormState["uitkeringsverloop"])}>
                    <option value="">— kies —</option>
                    <option value="dalend">dalend</option><option value="gelijkblijvend">gelijkblijvend</option>
                  </select>
                </Field>
              </div>
            )}
          </>
        )}
        {p.product === "DIL" && (
          <div style={{ marginTop: 13 }}>
            <Field label="Einddatum (leeg = levenslang)">
              <input type="date" className="control" value={form.einddatum} onChange={(e) => set("einddatum", e.target.value)} />
            </Field>
          </div>
        )}
      </div>

      <div className="section">
        <label className="check-row" style={{ padding: 0, marginBottom: p.partnerAan ? 13 : 0 }}>
          <span className="check-name">Partner meenemen</span>
          <input type="checkbox" checked={p.partnerAan} onChange={(e) => p.setPartnerAan(e.target.checked)} />
        </label>
        {p.partnerAan && (
          <>
            <div className="grid2" style={{ marginBottom: 13 }}>
              <Field label="Geslacht partner">
                <select className="control" value={form.geslachtPartner} onChange={(e) => set("geslachtPartner", e.target.value as "man" | "vrouw")}>
                  <option value="man">man</option><option value="vrouw">vrouw</option>
                </select>
              </Field>
              <Field label="Geboortedatum">
                <input type="date" className="control" value={form.geboortePartner} onChange={(e) => set("geboortePartner", e.target.value)} />
              </Field>
            </div>
            {p.product === "DIL" ? (
              <Field label="Partnerpensioen %">
                <select className="control" value={form.partnerpensioen} onChange={(e) => set("partnerpensioen", Number(e.target.value))}>
                  <option value={0}>0%</option><option value={70}>70%</option><option value={100}>100%</option>
                </select>
              </Field>
            ) : (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--slate)" }}>Overgang op partner: {form.overgang}%</label>
                <input type="range" min={1} max={70} value={form.overgang} onChange={(e) => set("overgang", Number(e.target.value))} style={{ marginTop: 8 }} />
              </div>
            )}
          </>
        )}
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="section" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {errors.map((i, k) => <div key={"e" + k} className="notice error">{i.bericht}</div>)}
          {warnings.map((i, k) => <div key={"w" + k} className="notice warning">{i.bericht}</div>)}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button className="btn" onClick={p.onBereken} disabled={errors.length > 0 || p.bezig || p.geselecteerd.length === 0}>
          {p.bezig ? "Berekenen…" : "Bereken vergelijking"}
        </button>
      </div>
    </aside>
  );
}
