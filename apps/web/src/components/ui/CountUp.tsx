import { useCountUp } from "../../lib/motion";

export function CountUp({ value, className }: { value: number; className?: string }) {
  const shown = useCountUp(value);
  return <span className={className}>{shown}</span>;
}
