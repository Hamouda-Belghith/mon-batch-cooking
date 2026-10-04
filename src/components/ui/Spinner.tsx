export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
