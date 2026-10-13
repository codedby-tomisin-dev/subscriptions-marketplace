import { useId } from "react";

const STAR_PATH = "M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z";

/** Five stars with fractional fill (e.g. 4.4 fills the last star 40%). */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const id = useId();
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} style={{ display: "inline-flex", gap: 2 }}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, value - index));
        const gradientId = `${id}-${index}`;
        return (
          <svg key={index} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={gradientId}>
                <stop offset={fill} stopColor="var(--apricot-500)" />
                <stop offset={fill} stopColor="var(--cream-200)" />
              </linearGradient>
            </defs>
            <path d={STAR_PATH} fill={`url(#${gradientId})`} stroke="var(--apricot-500)" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        );
      })}
    </span>
  );
}
