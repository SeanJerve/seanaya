import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes } from "react";

export function FieldWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const fieldClass = "font-sans w-full rounded-2xl border border-white/50 bg-white/60 backdrop-blur-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40";

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
      className="font-sans font-semibold w-full rounded-full bg-foreground/90 py-3 text-sm text-background shadow-[0_10px_30px_-14px_rgba(0,0,0,0.4)] disabled:opacity-50 transition active:scale-[0.99]"
    >{children}</button>
  );
}
