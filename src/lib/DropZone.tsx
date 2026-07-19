import { useState, type ReactNode } from "react";

type Props = {
  onFile: (file: File) => void;
  accept?: string;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
};

export function DropZone({
  onFile,
  accept = "image/*",
  className = "",
  children,
  disabled,
}: Props) {
  const [over, setOver] = useState(false);

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`${className} ${over ? "ring-2 ring-primary/50" : ""} transition cursor-pointer w-full text-left block ${disabled ? "pointer-events-none opacity-50" : ""}`}
      aria-label="Drop or choose an image"
    >
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
      {children}
    </label>
  );
}
