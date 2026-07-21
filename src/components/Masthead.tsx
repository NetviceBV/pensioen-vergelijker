import type { Omgeving } from "../domain/types";
import { Zuil } from "./ui";

const ENV_META: Record<Omgeving, { label: string; dot: string }> = {
  test: { label: "Test", dot: "#c99a3d" },
  acceptatie: { label: "Acceptatie", dot: "#5aa9c2" },
  productie: { label: "Productie", dot: "#d98a8a" },
};

export function Masthead({ omgeving, onOmgeving }: { omgeving: Omgeving; onOmgeving: (o: Omgeving) => void }) {
  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="brand">
          <span className="seal"><Zuil /></span>
          <div>
            <h1>Pensioen Vergelijker</h1>
            <div className="sub">Direct ingaande uitkeringen &middot; meerdere verzekeraars</div>
          </div>
        </div>
        <div className="env-control">
          <span className="env-label">Omgeving</span>
          <div className="seg" role="group" aria-label="Omgeving">
            {(Object.keys(ENV_META) as Omgeving[]).map((k) => (
              <button key={k} aria-pressed={k === omgeving} onClick={() => onOmgeving(k)}
                style={k === omgeving ? { background: "#f2f6f6" } : undefined}>
                <span className="dot" style={{ background: ENV_META[k].dot }} />
                {ENV_META[k].label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
