// Mascote animado do Papaléguas — o elemento de assinatura da marca.
// Usado nos momentos de carregamento (login, troca de painel) em vez de
// um spinner genérico. Corre sobre a "faixa tracejada" que já é o
// elemento visual da rota em outras partes do app.
export default function PapaLeguasRunner({ size = 90, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ position: 'relative', width: `${size + 40}px`, height: `${Math.round(size * 0.7) + 18}px`, overflow: 'hidden' }}>
        <style>{`
          @keyframes plr-dash {
            0%   { transform: translateX(-15%); }
            100% { transform: translateX(115%); }
          }
          @keyframes plr-leg-a {
            0%, 100% { transform: rotate(28deg); }
            50%      { transform: rotate(-28deg); }
          }
          @keyframes plr-leg-b {
            0%, 100% { transform: rotate(-28deg); }
            50%      { transform: rotate(28deg); }
          }
          @keyframes plr-bob {
            0%, 100% { transform: translateY(0); }
            50%      { transform: translateY(-6px); }
          }
          @keyframes plr-dust {
            0%   { opacity: 0.5; transform: scale(0.4) translateX(0); }
            100% { opacity: 0;   transform: scale(1.4) translateX(-40px); }
          }
          .plr-runner { animation: plr-dash 3.2s linear infinite, plr-bob 0.28s ease-in-out infinite; }
          .plr-leg-front { transform-origin: 50% 10%; animation: plr-leg-a 0.28s ease-in-out infinite; }
          .plr-leg-back  { transform-origin: 50% 10%; animation: plr-leg-b 0.28s ease-in-out infinite; }
          .plr-dust-1 { animation: plr-dust 0.6s ease-out infinite; }
          .plr-dust-2 { animation: plr-dust 0.6s ease-out 0.2s infinite; }
          .plr-dust-3 { animation: plr-dust 0.6s ease-out 0.4s infinite; }
          @media (prefers-reduced-motion: reduce) {
            .plr-runner, .plr-leg-front, .plr-leg-back, .plr-dust-1, .plr-dust-2, .plr-dust-3 {
              animation: none !important;
            }
          }
        `}</style>

        <div className="route-divider" style={{ position: 'absolute', left: 0, right: 0, bottom: '16px' }} />

        <div className="plr-runner" style={{ position: 'absolute', bottom: '8px', width: `${size}px` }}>
          <svg viewBox="0 0 100 70" width={size} height={Math.round(size * 0.7)}>
            <circle className="plr-dust-1" cx="8" cy="60" r="5" fill="var(--ink-inverse)" opacity="0.15" />
            <circle className="plr-dust-2" cx="4" cy="55" r="4" fill="var(--ink-inverse)" opacity="0.12" />
            <circle className="plr-dust-3" cx="10" cy="50" r="3" fill="var(--ink-inverse)" opacity="0.1" />
            <rect className="plr-leg-back" x="46" y="38" width="5" height="26" rx="2" fill="var(--ink-inverse)" />
            <ellipse cx="55" cy="38" rx="26" ry="15" fill="var(--lime-500)" stroke="var(--ink-inverse)" strokeWidth="3" />
            <path d="M78 30 Q95 18 90 40 Q84 34 78 34 Z" fill="var(--lime-500)" stroke="var(--ink-inverse)" strokeWidth="3" />
            <path d="M32 30 Q18 20 22 10" fill="none" stroke="var(--ink-inverse)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="20" cy="8" r="7" fill="var(--lime-500)" stroke="var(--ink-inverse)" strokeWidth="3" />
            <path d="M13 8 L1 6 L13 12 Z" fill="var(--ink-inverse)" />
            <circle cx="22" cy="6" r="1.4" fill="var(--ink-inverse)" />
            <rect className="plr-leg-front" x="58" y="38" width="5" height="26" rx="2" fill="var(--ink-inverse)" />
          </svg>
        </div>
      </div>

      {label && (
        <p className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--mist-400)', margin: 0 }}>
          {label}
        </p>
      )}
    </div>
  )
}
