import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const IconCursor = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 2l9 5.5-4 1-1.5 4L4 2z" />
  </svg>
);

export const IconFrame = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4.5 1.5v13M11.5 1.5v13M1.5 4.5h13M1.5 11.5h13" />
  </svg>
);

export const IconStack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2.5" y="2" width="11" height="4.5" rx="1" />
    <rect x="2.5" y="9.5" width="11" height="4.5" rx="1" />
  </svg>
);

export const IconRow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="2.5" width="4.5" height="11" rx="1" />
    <rect x="9.5" y="2.5" width="4.5" height="11" rx="1" />
  </svg>
);

export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);

export const IconText = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 3.5h10M8 3.5v9.5" />
  </svg>
);

export const IconImage = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <circle cx="5.5" cy="6" r="1.2" />
    <path d="M2 11.5l3.5-3 3 2.5 3-3.5 2.5 2.5" />
  </svg>
);

export const IconHand = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 7.5V3.8a1 1 0 012 0V7m0-3.7v-1a1 1 0 012 0V7m0-3.5a1 1 0 012 0V8m0-2.5a1 1 0 012 0v4.2c0 2.9-1.8 4.8-4.5 4.8-2.2 0-3.2-.9-4.3-2.8L3 9.4a1.1 1.1 0 011.8-1.2l.7 1" />
  </svg>
);

export const IconComponent = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 1.5L11 4.5 8 7.5 5 4.5zM11.5 5L14.5 8l-3 3-3-3zM4.5 5l3 3-3 3-3-3zM8 8.5l3 3-3 3-3-3z" />
  </svg>
);

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9.5h6.6L12 4M6.5 7v4M9.5 7v4" />
  </svg>
);

export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 1.5l6.5 11.5H1.5L8 1.5z" />
    <path d="M8 6v3.5M8 11.5h.01" />
  </svg>
);

export const IconRefresh = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M13.5 2.5v3.5H10" />
    <path d="M2.5 8a5.5 5.5 0 019.2-2.8L13.5 6" />
    <path d="M2.5 13.5v-3.5H6" />
    <path d="M13.5 8a5.5 5.5 0 01-9.2 2.8L2.5 10" />
  </svg>
);

export const IconEye = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);

export const IconEyeOff = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 2l12 12M6.5 3.8A6.6 6.6 0 018 3.5c4 0 6.5 4.5 6.5 4.5a12.5 12.5 0 01-2.1 2.6M4 5.2A12 12 0 001.5 8S4 12.5 8 12.5a6 6 0 002.6-.6" />
  </svg>
);

export const IconLock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3.5" y="7" width="9" height="7" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
  </svg>
);

export const IconCaret = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 16 16" fill="currentColor" {...p}>
    <path d="M5.5 3.5l5 4.5-5 4.5z" />
  </svg>
);

export const IconPage = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 1.5h5.5L12.5 5v9.5h-8.5z" />
    <path d="M9.5 1.5V5h3" />
  </svg>
);

export const IconFullWidth = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M1.5 8h13M4 5.5L1.5 8 4 10.5M12 5.5L14.5 8 12 10.5" />
  </svg>
);

export const IconDesktop = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="1.5" y="2.5" width="13" height="9" rx="1" />
    <path d="M6 14h4M8 11.5V14" />
  </svg>
);

export const IconTablet = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="1.5" width="10" height="13" rx="1.5" />
    <path d="M7 12.5h2" />
  </svg>
);

export const IconPhone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" />
    <path d="M7 12.5h2" />
  </svg>
);

export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 16 16" fill="currentColor" {...p}>
    <path d="M4.5 2.5l8.5 5.5-8.5 5.5z" />
  </svg>
);

export const IconUndo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2.5 6.5h7a4 4 0 014 4v0a4 4 0 01-4 4h-3" />
    <path d="M5.5 3.5l-3 3 3 3" />
  </svg>
);

export const IconRedo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M13.5 6.5h-7a4 4 0 00-4 4v0a4 4 0 004 4h3" />
    <path d="M10.5 3.5l3 3-3 3" />
  </svg>
);

export const IconBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M10 3L5 8l5 5" />
  </svg>
);

export const IconLink = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6.5 9.5l3-3M5 7L3.3 8.7a2.4 2.4 0 003.4 3.4l1.7-1.7M11 9l1.7-1.7a2.4 2.4 0 00-3.4-3.4L7.6 5.6" />
  </svg>
);

export const IconDatabase = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <ellipse cx="8" cy="3.5" rx="5.5" ry="2" />
    <path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9" />
    <path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" />
  </svg>
);

export const IconButton = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="1.5" y="5" width="13" height="6" rx="3" />
    <path d="M5 8h6" />
  </svg>
);

export const IconInput = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="1.5" y="5" width="13" height="6" rx="1.5" />
    <path d="M4 8h.01" strokeWidth={2} />
  </svg>
);

export const IconVideo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="1.5" y="3.5" width="9" height="9" rx="1.5" />
    <path d="M10.5 7l4-2.5v7l-4-2.5" />
  </svg>
);

export const IconList = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" strokeWidth={1.6} />
  </svg>
);

export const IconDots = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 16 16" fill="currentColor" {...p}>
    <circle cx="3.5" cy="8" r="1.3" />
    <circle cx="8" cy="8" r="1.3" />
    <circle cx="12.5" cy="8" r="1.3" />
  </svg>
);

export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
  </svg>
);

export const IconSparkle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 1.5l1.6 4.9L14.5 8l-4.9 1.6L8 14.5 6.4 9.6 1.5 8l4.9-1.6z" />
  </svg>
);

export const IconUpload = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 10.5v-8M4.5 6L8 2.5 11.5 6M2.5 13.5h11" />
  </svg>
);

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2.5 8.5l3.5 3.5 7.5-8" />
  </svg>
);

export const IconArrowUp = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M8 13V3M3.75 7.25L8 3l4.25 4.25" />
  </svg>
);

export const IconPencil = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 13l.65-3.1L10.8 2.75a1.55 1.55 0 012.2 2.2L5.85 12.1 3 13zM9.75 3.8l2.2 2.2" />
  </svg>
);

export const IconStop = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 16 16" fill="currentColor" {...p}>
    <rect x="5" y="5" width="6" height="6" rx="1" />
  </svg>
);
