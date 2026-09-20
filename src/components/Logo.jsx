export default function Logo({ compact = false }) {
  return (
    <span className="brand-lockup" aria-label="Papaleguas">
      <span className="roadbird-mark" aria-hidden="true">
        <svg viewBox="0 0 96 64" role="img">
          <path className="roadbird-mark__speed speed-a" d="M9 41h22" />
          <path className="roadbird-mark__speed speed-b" d="M3 50h30" />
          <path className="roadbird-mark__tail" d="M32 31c-7-7-16-10-24-8 8 7 16 11 26 12" />
          <path className="roadbird-mark__body" d="M31 39c2-14 15-25 31-25 10 0 18 5 23 12-10-1-16 2-21 7-6 7-15 10-28 9l-10 12" />
          <path className="roadbird-mark__wing" d="M48 38c4-8 12-14 24-16-4 8-10 15-21 21" />
          <path className="roadbird-mark__head" d="M59 16c5-10 14-13 24-10-4 2-7 5-8 9 6-1 11 1 16 5-9 1-16 4-22 10" />
          <circle className="roadbird-mark__eye" cx="71" cy="17" r="2.3" />
          <path className="roadbird-mark__beak" d="M81 18l12 3-12 4" />
          <path className="roadbird-mark__leg leg-a" d="M45 43l-8 16h12" />
          <path className="roadbird-mark__leg leg-b" d="M56 41l8 15h13" />
        </svg>
      </span>
      {!compact && <span className="brand-lockup__name">Papaleguas</span>}
    </span>
  )
}
