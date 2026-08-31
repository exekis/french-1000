// decorative paper scraps drawn as inline svg so the site keeps working offline and
// no binary art files enter the repository. every piece inherits currentColor and the
// collage layer tints it, which is what keeps the set looking like one album

export function StampEphemera() {
  return (
    <svg viewBox="0 0 84 100" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="78"
        height="94"
        fill="var(--paper-card)"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="1 4"
        strokeLinecap="round"
      />
      <rect
        x="11"
        y="11"
        width="62"
        height="78"
        stroke="currentColor"
        strokeWidth="0.9"
      />
      <path
        d="M42 20 34 66h16zM42 20v46M31 52h22M28 62h28M36 38h12"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M24 70h36" stroke="currentColor" strokeWidth="0.8" />
      <text
        x="42"
        y="82"
        fill="currentColor"
        fontSize="8"
        fontFamily="Georgia, serif"
        letterSpacing="1.4"
        textAnchor="middle"
      >
        POSTES
      </text>
    </svg>
  );
}

export function PostmarkEphemera() {
  return (
    <svg viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <circle cx="48" cy="48" r="34" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="48" cy="48" r="28" stroke="currentColor" strokeWidth="0.8" />
      <path
        d="M6 40c8-5 14 5 22 0s14 5 22 0 14 5 22 0 14 5 18 0M6 54c8-5 14 5 22 0s14 5 22 0 14 5 22 0 14 5 18 0"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <text
        x="48"
        y="42"
        fill="currentColor"
        fontSize="10"
        fontFamily="Georgia, serif"
        letterSpacing="1.6"
        textAnchor="middle"
      >
        PARIS
      </text>
      <text
        x="48"
        y="62"
        fill="currentColor"
        fontSize="8"
        fontFamily="Georgia, serif"
        letterSpacing="0.8"
        textAnchor="middle"
      >
        1902
      </text>
    </svg>
  );
}

export function FlourishEphemera() {
  return (
    <svg viewBox="0 0 128 96" fill="none" aria-hidden="true">
      <path
        d="M6 62c22 4 34-8 40-24 4-11 14-14 20-8 7 7 1 18-9 17-14-2-16-18-6-27"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M122 62c-22 4-34-8-40-24-4-11-14-14-20-8-7 7-1 18 9 17 14-2 16-18 6-27"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M50 70c8 6 20 6 28 0M58 78c4 3 8 3 12 0"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle cx="64" cy="60" r="3" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function SprigEphemera() {
  return (
    <svg viewBox="0 0 64 132" fill="none" aria-hidden="true">
      <path
        d="M32 128C30 96 30 60 34 6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M33 100c-12 2-20-4-22-14 12-4 20 2 22 14ZM33 76c12 2 20-4 22-14-12-4-20 2-22 14ZM33 52c-11 2-18-4-20-13 11-4 18 2 20 13ZM34 30c10 1 17-4 19-12-10-4-17 2-19 12Z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      <circle cx="35" cy="12" r="4" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function PostcardEphemera() {
  return (
    <svg viewBox="0 0 140 96" fill="none" aria-hidden="true">
      <path
        d="M4 8h132v80H4z"
        fill="var(--paper-card)"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M70 14v68" stroke="currentColor" strokeWidth="0.8" />
      <rect
        x="104"
        y="16"
        width="24"
        height="20"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeDasharray="1 2.5"
      />
      <path
        d="M80 50h48M80 60h44M80 70h50"
        stroke="currentColor"
        strokeWidth="0.8"
      />
      <path
        d="M14 76c8-16 14-26 20-30 7-5 10 4 16-2 5-5 8-14 12-22"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path d="M14 76h46" stroke="currentColor" strokeWidth="0.9" />
      <circle cx="26" cy="30" r="5" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  );
}

export function TicketEphemera() {
  return (
    <svg viewBox="0 0 144 62" fill="none" aria-hidden="true">
      <path
        d="M4 6h136v50H4zM4 26a6 6 0 0 0 0 12M140 26a6 6 0 0 1 0 12"
        fill="var(--paper-card)"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M104 8v46"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeDasharray="2 3"
      />
      <text
        x="54"
        y="28"
        fill="currentColor"
        fontSize="11"
        fontFamily="Georgia, serif"
        letterSpacing="2"
        textAnchor="middle"
      >
        ADMET UN
      </text>
      <path d="M22 40h64" stroke="currentColor" strokeWidth="0.7" />
      <text
        x="122"
        y="36"
        fill="currentColor"
        fontSize="13"
        fontFamily="Georgia, serif"
        textAnchor="middle"
      >
        №
      </text>
    </svg>
  );
}

export function TowerEphemera() {
  return (
    <svg viewBox="0 0 76 148" fill="none" aria-hidden="true">
      <path
        d="M38 8v132M30 140h16M8 144c6-26 16-52 22-84 2-11 4-30 8-52M68 144c-6-26-16-52-22-84-2-11-4-30-8-52"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M20 104h36M25 78h26M29 56h18M32 38h12"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M20 104 56 78M56 104 20 78M25 78l26-22M51 78 25 56"
        stroke="currentColor"
        strokeWidth="0.7"
        opacity="0.7"
      />
      <path d="M8 144h60" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function ButterflyEphemera() {
  return (
    <svg viewBox="0 0 100 78" fill="none" aria-hidden="true">
      <path
        d="M50 20c-8-14-26-18-36-8-9 9-4 24 8 29-10 4-13 16-5 22 9 7 24 1 33-17"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M50 20c8-14 26-18 36-8 9 9 4 24-8 29 10 4 13 16 5 22-9 7-24 1-33-17"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M50 18v42M50 18c-3-6-6-9-10-11M50 18c3-6 6-9 10-11"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M28 26c6 2 11 6 14 12M72 26c-6 2-11 6-14 12"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.75"
      />
    </svg>
  );
}

export function KeyEphemera() {
  return (
    <svg viewBox="0 0 132 46" fill="none" aria-hidden="true">
      <circle cx="24" cy="23" r="15" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="24" cy="23" r="7" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M39 23h86M112 23v12M100 23v9M124 23v14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M8 14c4-6 10-8 16-8" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

export function LabelEphemera() {
  return (
    <svg viewBox="0 0 96 124" fill="none" aria-hidden="true">
      <path
        d="M48 4 88 26v94H8V26z"
        fill="var(--paper-card)"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="48" cy="24" r="5" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M20 48h56M20 60h56M20 72h40M20 84h50M20 96h34"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.8"
      />
    </svg>
  );
}

// a divider for the masthead, in the same engraved line style as the scraps
export function OrnamentRule() {
  return (
    <svg
      className="header-ornament"
      viewBox="0 0 240 26"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 13h74M164 13h74"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M76 13c8-9 16-9 20 0s12 9 20 0M164 13c-8-9-16-9-20 0s-12 9-20 0"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M120 5v16M114 9l12 8M126 9l-12 8"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <circle cx="120" cy="13" r="3.4" stroke="currentColor" strokeWidth="1" />
      <circle cx="70" cy="13" r="1.6" fill="currentColor" />
      <circle cx="170" cy="13" r="1.6" fill="currentColor" />
    </svg>
  );
}

export const ephemeraPieces = [
  StampEphemera,
  SprigEphemera,
  PostmarkEphemera,
  PostcardEphemera,
  TowerEphemera,
  FlourishEphemera,
  TicketEphemera,
  ButterflyEphemera,
  LabelEphemera,
  KeyEphemera,
] as const;
