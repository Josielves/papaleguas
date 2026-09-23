export default function Logo({ compact = false }) {
  return (
    <span className="brand-lockup" aria-label="Papaleguas">
      <span className="roadbird-mark" aria-hidden="true">
        <img src="/papaleguas-blue-roadrunner.png" alt="" />
      </span>
      {!compact && <span className="brand-lockup__name">Papaleguas</span>}
    </span>
  )
}
