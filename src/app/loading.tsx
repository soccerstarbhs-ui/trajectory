export default function Loading() {
  return (
    <main className="trajectory-shell loading-shell" aria-busy="true" aria-label="Loading trajectory">
      <div className="loading-heading">
        <span />
        <strong />
        <i />
      </div>
      <div className="loading-action" />
      <div className="loading-graph">
        {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
      </div>
    </main>
  );
}
