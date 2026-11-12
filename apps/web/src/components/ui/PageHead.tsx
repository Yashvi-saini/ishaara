import type { ReactNode } from "react";

export interface PageHeadProps {
  title: string;
  lede?: ReactNode;
  chip?: ReactNode;
  aside?: ReactNode;
}

export function PageHead({ title, lede, chip, aside }: PageHeadProps) {
  return (
    <header className="flex animate-rise flex-col gap-4 pt-2 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[34px] leading-none font-medium tracking-[-0.045em] text-balance md:text-[40px]">
            {title}
          </h1>
          {chip}
        </div>
        {lede && (
          <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-pretty text-ink-2">
            {lede}
          </p>
        )}
      </div>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </header>
  );
}
