import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import type { Omgeving, Product, Uitkeringstermijn, VergelijkResultaat } from "../domain/types";
import { euro, euro0, pct } from "../domain/format";

interface Props {
  resultaten: VergelijkResultaat[] | null;
  bezig: boolean;
  product: Product;
  termijn: Uitkeringstermijn;
  omgeving: Omgeving;
}

// TIJDELIJK: knopje + paneel voor ruwe request/response per verzekeraar — later weer verwijderen.
function DebugKnop({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ruwe request/response tonen"
      aria-label="Ruwe request/response tonen"
      style={{
        marginLeft: 6, border: "1px solid currentColor", background: open ? "var(--slate-faint)" : "none",
        color: "var(--slate-faint)", cursor: "pointer", borderRadius: "50%", width: 15, height: 15,
        lineHeight: "13px", fontSize: 10, fontWeight: 700, padding: 0, display: "inline-block", textAlign: "center", verticalAlign: "middle",
      }}
    >
      i
    </button>
  );
}

function DebugPaneel({ resultaat }: { resultaat: VergelijkResultaat }) {
  return (
    <div className="panel" style={{ padding: 14, marginTop: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>{resultaat.verzekeraarNaam} — ruwe request/response</div>
      <pre style={{ fontSize: 11, overflowX: "auto", background: "var(--slate-faint)", padding: 10, borderRadius: 6, margin: 0 }}>
        {resultaat.debug ? JSON.stringify(resultaat.debug, null, 2) : "Geen debug-informatie beschikbaar voor dit resultaat."}
      </pre>
    </div>
  );
}

export function Resultaat({ resultaten, bezig, product, termijn, omgeving }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  if (!resultaten && !bezig) {
    return <div className="empty">Kies een product en verzekeraars en bereken de vergelijking.</div>;
  }
  if (bezig || !resultaten) {
    return <div className="empty">Berekenen…</div>;
  }

  const geopend = resultaten.filter((r) => open[r.verzekeraarId]);

  const gelukt = resultaten.filter((r) => r.status === "succes" && r.berekening);
  if (gelukt.length === 0) {
    return (
      <div className="stack">
        <div className="panel" style={{ padding: 20 }}>
          {resultaten.map((r) => (
            <div key={r.verzekeraarId} className="notice error" style={{ marginBottom: 8 }}>
              <strong>{r.verzekeraarNaam}:</strong>&nbsp;{r.fouten?.join(" ")}
              <DebugKnop open={!!open[r.verzekeraarId]} onClick={() => toggle(r.verzekeraarId)} />
            </div>
          ))}
        </div>
        {geopend.map((r) => <DebugPaneel key={r.verzekeraarId} resultaat={r} />)}
      </div>
    );
  }

  const beste = gelukt.reduce((b, x) =>
    (x.berekening!.eersteTermijn.netto > (b?.berekening?.eersteTermijn.netto ?? -1) ? x : b), gelukt[0]);
  const bestId = beste.verzekeraarId;

  const chartData = gelukt.map((r) => ({ naam: r.verzekeraarNaam, netto: Math.round(r.berekening!.eersteTermijn.netto), id: r.verzekeraarId }));

  const rijen: { label: string; get: (r: VergelijkResultaat) => string; accent?: boolean }[] = [
    { label: `Netto per ${termijn}`, get: (r) => euro(r.berekening!.eersteTermijn.netto), accent: true },
    { label: `Bruto per ${termijn}`, get: (r) => euro(r.berekening!.eersteTermijn.bruto) },
    { label: "Netto per jaar", get: (r) => euro(r.berekening!.perJaar.netto) },
    { label: "Garantierente", get: (r) => r.berekening!.garantierente != null ? pct(r.berekening!.garantierente) : "—" },
    ...(product === "DIKP"
      ? [{ label: "Scenariomarge (pess.–opt.)", get: (r: VergelijkResultaat) => r.berekening!.band ? `${euro(r.berekening!.band.pessimistisch)} – ${euro(r.berekening!.band.optimistisch)}` : "—" }]
      : []),
    { label: `Poliskosten per ${termijn}`, get: (r) => r.berekening!.poliskostenPerTermijn != null ? euro(r.berekening!.poliskostenPerTermijn) : "—" },
    { label: "Eenmalige kosten", get: (r) => r.berekening!.eenmaligeKosten != null ? euro(r.berekening!.eenmaligeKosten) : "—" },
  ];

  return (
    <div className="stack">
      <div className="panel headline">
        <div>
          <div className="lead">Hoogste netto-uitkering per {termijn}</div>
          <div className="who">{beste.verzekeraarNaam}</div>
        </div>
        <div>
          <div className="amount">{euro(beste.berekening!.eersteTermijn.netto)}</div>
          <small>bruto {euro(beste.berekening!.eersteTermijn.bruto)}</small>
        </div>
      </div>

      <div className="panel">
        <div className="card-head">
          <h3>Netto uitkering per {termijn}</h3>
          <span className="meta">{product} &middot; flat-rate 59%</span>
        </div>
        <div style={{ height: 190, padding: "6px 14px 14px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e8edee" vertical={false} />
              <XAxis dataKey="naam" tick={{ fontSize: 12, fill: "#5f707a" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8a99a1" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => euro0(Number(v))} />
              <Tooltip formatter={(v) => euro(Number(v))} cursor={{ fill: "rgba(14,58,79,0.04)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid #d8e0e3", fontFamily: "IBM Plex Sans", fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
              <Bar dataKey="netto" radius={[5, 5, 0, 0]} maxBarSize={72}>
                {chartData.map((d) => <Cell key={d.id} fill={d.id === bestId ? "#B0873A" : "#7d97a1"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel statement">
        <table className="stmt">
          <thead>
            <tr>
              <th className="kenmerk"><span className="eyebrow">Kenmerk</span></th>
              {gelukt.map((r) => (
                <th key={r.verzekeraarId} className={r.verzekeraarId === bestId ? "col-best" : undefined}>
                  {r.verzekeraarId === bestId && <div className="best-mark">◆ Hoogste</div>}
                  <div className="ins">
                    {r.verzekeraarNaam}
                    <DebugKnop open={!!open[r.verzekeraarId]} onClick={() => toggle(r.verzekeraarId)} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rijen.map((row, ri) => (
              <tr key={ri} className={row.accent ? "accent" : undefined}>
                <td className="kenmerk">{row.label}</td>
                {gelukt.map((r) => (
                  <td key={r.verzekeraarId} className={`num${r.verzekeraarId === bestId ? " col-best" : ""}`}>{row.get(r)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="kenmerk" style={{ color: "var(--slate-faint)", fontSize: 11.5 }}>Endpoint</td>
              {gelukt.map((r) => (
                <td key={r.verzekeraarId} className={r.verzekeraarId === bestId ? "col-best" : undefined}>
                  <div className="endpoint">{r.endpoint}</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="foot">
          Bruto-naar-netto met een vlaktarief van 59% (aanname van de verzekeraar), uitsluitend indicatief — geen fiscale toezegging.
          Bedragen berekend voor de eerste uitkeringstermijn op leeftijd {beste.berekening!.leeftijd}.
        </div>
      </div>

      {resultaten.some((r) => r.status === "fout") && (
        <div className="panel" style={{ padding: 18 }}>
          {resultaten.filter((r) => r.status === "fout").map((r) => (
            <div key={r.verzekeraarId} className="notice warning" style={{ marginBottom: 6 }}>
              <strong>{r.verzekeraarNaam}:</strong>&nbsp;{r.fouten?.join(" ")}
              <DebugKnop open={!!open[r.verzekeraarId]} onClick={() => toggle(r.verzekeraarId)} />
            </div>
          ))}
        </div>
      )}

      {geopend.map((r) => <DebugPaneel key={r.verzekeraarId} resultaat={r} />)}
    </div>
  );
}
