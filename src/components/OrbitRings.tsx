export default function OrbitRings() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute left-[-10%] top-1/2 h-[140%] w-[140%] -translate-y-1/2 animate-[spin_90s_linear_infinite]">
        <svg viewBox="0 0 800 800" className="h-full w-full">
          <defs>
            <linearGradient id="ring-fade" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#39ff5f" stopOpacity="0" />
              <stop offset="50%" stopColor="#39ff5f" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#39ff5f" stopOpacity="0" />
            </linearGradient>
          </defs>
          <ellipse
            cx="400"
            cy="400"
            rx="360"
            ry="90"
            transform="rotate(-18 400 400)"
            fill="none"
            stroke="url(#ring-fade)"
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <div className="absolute left-[-10%] top-1/2 h-[140%] w-[140%] -translate-y-1/2 animate-[spin_130s_linear_infinite_reverse]">
        <svg viewBox="0 0 800 800" className="h-full w-full">
          <ellipse
            cx="400"
            cy="400"
            rx="300"
            ry="70"
            transform="rotate(-10 400 400)"
            fill="none"
            stroke="#39ff5f"
            strokeOpacity="0.2"
            strokeWidth="1"
          />
        </svg>
      </div>
      <div className="absolute left-[-10%] top-1/2 h-[140%] w-[140%] -translate-y-1/2 animate-[spin_70s_linear_infinite]">
        <svg viewBox="0 0 800 800" className="h-full w-full">
          <ellipse
            cx="400"
            cy="400"
            rx="250"
            ry="55"
            transform="rotate(-25 400 400)"
            fill="none"
            stroke="#39ff5f"
            strokeOpacity="0.15"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}
