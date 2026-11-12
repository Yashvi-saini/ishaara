import { useEffect, useId, useRef, type ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description !== undefined ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[26px] bg-card p-0 text-ink shadow-[0_40px_80px_-30px_rgb(0_0_0/0.45)]"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-[22px] font-medium tracking-[-0.035em]">
          {title}
        </h2>
        {description !== undefined && (
          <p id={descriptionId} className="mt-2 text-[14px] leading-relaxed text-ink-2">
            {description}
          </p>
        )}
        {children !== undefined && <div className="mt-4">{children}</div>}
      </div>
      {footer !== undefined && (
        <div className="flex flex-wrap justify-end gap-2 px-6 pb-6">{footer}</div>
      )}
    </dialog>
  );
}
