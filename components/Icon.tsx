import { ICONS } from "@/lib/constants";

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
