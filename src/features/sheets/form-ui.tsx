import type {
  ReactNode,
  SelectHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ButtonHTMLAttributes,
} from "react";

export function FieldWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-semibold text-sn-ink">
        {label}
      </span>
      {children}
    </label>
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
export function PrimaryButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="font-sans font-semibold w-full rounded-full bg-sn-navy py-3.5 text-[15px] text-white shadow-[0_12px_24px_-14px_rgba(31,42,92,0.8)] transition hover:bg-[#28356f] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
    >
      {children}
    </button>
  );
}
