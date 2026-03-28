interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

export function FormField({ label, required, hint, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-text/50 font-medium mb-2">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-text/30">{hint}</p>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function AdminInput({ className = "", ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`w-full border border-border-subtle bg-white px-4 py-2.5 text-sm text-text placeholder:text-text/25 focus:outline-none focus:border-accent-gold/50 transition-colors ${className}`}
    />
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export function AdminTextarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`w-full border border-border-subtle bg-white px-4 py-2.5 text-sm text-text placeholder:text-text/25 focus:outline-none focus:border-accent-gold/50 transition-colors resize-none ${className}`}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  children: React.ReactNode;
}

export function AdminSelect({ className = "", children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`w-full border border-border-subtle bg-white px-4 py-2.5 text-sm text-text focus:outline-none focus:border-accent-gold/50 transition-colors appearance-none ${className}`}
    >
      {children}
    </select>
  );
}
