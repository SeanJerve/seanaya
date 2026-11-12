import type {
  ReactNode,
  SelectHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ButtonHTMLAttributes,
} from "react";
import { CloudOff, ImagePlus, X } from "lucide-react";
import { DropZone } from "@/lib/DropZone";

/** Every sheet form: one column, one rhythm. */
export function FormStack({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}

export function FieldWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-sn-ink">{label}</span>
      {children}
    </label>
  );
}

/** Plain group label for things that aren't a single input (choices, toggles). */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-semibold text-sn-ink">{label}</div>
      {children}
    </div>
  );
}

const fieldClass =
  "font-sans w-full rounded-[16px] border border-[#e1e4f5] bg-white/85 px-4 py-3 text-[15px] text-sn-navy outline-none placeholder:text-sn-faint transition-colors focus:border-sn-periwinkle focus:bg-white focus:ring-4 focus:ring-[#8faaf0]/15";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ""}`} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClass} resize-none ${props.className ?? ""}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} capitalize ${props.className ?? ""}`} />;
}

/** The sheet's one action: a full-width keypad-glass button. */
export function PrimaryButton({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`sn-pill h-12 w-full text-[15px] ${className ?? ""}`}>
      {children}
    </button>
  );
}

/** Segmented choice: keypad buttons, the chosen one lit with the dock's blue. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label = (v: T) => v,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: (v: T) => ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`sn-pill h-10 px-4 text-[14px] capitalize ${value === o ? "sn-active" : ""}`}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

/** On/off row with a switch, same as Settings. */
export function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-12 w-full items-center justify-between gap-4 text-left text-[15px] text-sn-navy"
    >
      {label}
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border border-white/80 transition-colors ${on ? "bg-[radial-gradient(circle_at_35%_30%,#c9d8fd,#94b2f6_75%)]" : "bg-[#e3e5f1]"}`}
      >
        <span
          className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(60,80,150,0.35)] transition-[left] ${on ? "left-[24px]" : "left-[3px]"}`}
        />
      </span>
    </button>
  );
}

/** Photo slot: a soft drop area, or the chosen photo with a remove button. */
export function PhotoPicker({
  preview,
  onFile,
  onClear,
  height = "h-36",
}: {
  preview: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
  height?: string;
}) {
  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-[18px]">
        <img src={preview} alt="" className="h-48 w-full object-cover" />
        <button
          type="button"
          onClick={onClear}
          aria-label="Remove photo"
          className="sn-pill sn-icon-btn absolute right-2.5 top-2.5 h-9 w-9"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    );
  }
  return (
    <DropZone
      onFile={onFile}
      className={`flex ${height} flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-[#c9cfee] bg-white/45 text-[14px] font-semibold text-sn-ink hover:bg-white/70`}
    >
      <ImagePlus size={22} strokeWidth={1.6} className="text-[#5b6aa6]" />
      Add a photo
    </DropZone>
  );
}

/** One quiet line when there's no connection; drafts are kept either way. */
export function OfflineNote() {
  return (
    <div className="flex items-center gap-2 text-[13px] text-sn-muted">
      <CloudOff size={15} /> You're offline. This is saved as a draft.
    </div>
  );
}
