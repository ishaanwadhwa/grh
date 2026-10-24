// DLS input: label above in Caption, underlined field, brand underline on focus.

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  /** For anything that isn't one input (uploaders, steppers, pills): a <div>, so a click on it never
   *  "clicks the label" and fires the first button inside (that's how a photo got removed). */
  group?: boolean;
  children: React.ReactNode;
}

export function FormField({ label, required, hint, error, group, children }: FormFieldProps) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="field">
      <span className={`field-label ${group ? "mb-2" : ""}`}>{label}{required && <span className="req"> *</span>}</span>
      {children}
      {error ? <span className="hint error">{error}</span> : hint && <span className="hint">{hint}</span>}
    </Tag>
  );
}

export const AdminInput = ({ className = "", ...props }: React.ComponentProps<"input">) => <input {...props} className={`input ${className}`} />;

export const AdminTextarea = ({ className = "", ...props }: React.ComponentProps<"textarea">) => <textarea {...props} className={`input ${className}`} />;

export const AdminSelect = ({ className = "", ...props }: React.ComponentProps<"select">) => <select {...props} className={`input ${className}`} />;
