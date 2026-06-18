export function BorderLines({ count = 12 }: { count?: number }) {
  return (
    <div className="lg-border-frame" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="lg-border-line">
          <div
            className="lg-border-dot"
            style={{
              animationDelay: `${i * 0.45}s`,
              animationDuration: `${5 + (i % 4)}s`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
