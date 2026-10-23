import type { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: number;
};

function IconBase({
  size = 20,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
    >
      <rect width="48" height="48" rx="14" fill="url(#logo-gradient)" />
      <path
        d="M12 25.5c2.6-4.4 5.2-4.4 7.8 0s5.2 4.4 7.8 0 5.2-4.4 7.8 0"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M12 32.5c2.6-4.4 5.2-4.4 7.8 0s5.2 4.4 7.8 0 5.2-4.4 7.8 0"
        stroke="white"
        strokeOpacity=".56"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="15" r="3.2" fill="white" fillOpacity=".86" />
      <defs>
        <linearGradient id="logo-gradient" x1="4" y1="2" x2="44" y2="46">
          <stop stopColor="#2dd4bf" />
          <stop offset=".55" stopColor="#0ea5a4" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 18.5a4.5 4.5 0 0 1-.42-8.98A6 6 0 0 1 18.2 8.1 4.7 4.7 0 0 1 17.5 18.5H7Z" />
      <path d="M12 12v5" />
      <path d="m9.8 14.2 2.2-2.2 2.2 2.2" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 7h15" />
      <path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7" />
      <path d="m6.4 7 .8 12.1A1.9 1.9 0 0 0 9.1 21h5.8a1.9 1.9 0 0 0 1.9-1.9L17.6 7" />
      <path d="M10 11v5.5M14 11v5.5" />
    </IconBase>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 7v4h-4" />
      <path d="M18.3 15.5A7 7 0 1 1 19.6 9L20 11" />
    </IconBase>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 4H6.8A1.8 1.8 0 0 0 5 5.8v12.4A1.8 1.8 0 0 0 6.8 20H10" />
      <path d="M15 8l4 4-4 4" />
      <path d="M8.5 12H19" />
    </IconBase>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m16 16 4.2 4.2" />
    </IconBase>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 5h5v5" />
      <path d="M19 5 10.5 13.5" />
      <path d="M18 14.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5" />
    </IconBase>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12.5 4.2 4.2L19 7" />
    </IconBase>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.5 19 6v5.4c0 4.4-3 7.8-7 9.1-4-1.3-7-4.7-7-9.1V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3l2 2.4h7A2.5 2.5 0 0 1 20.5 10v7A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V7.5Z" />
    </IconBase>
  );
}

export function DeviceIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="7" y="2.8" width="10" height="18.4" rx="2.2" />
      <path d="M10.5 18.2h3" />
    </IconBase>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 4 21 20H3L12 4Z" />
      <path d="M12 9.5v4.5" />
      <path d="M12 17.2h.01" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconBase>
  );
}
