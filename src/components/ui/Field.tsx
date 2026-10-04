import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

interface FieldBase {
  label: string;
  name: string;
  hint?: string;
}

export function Field({
  label,
  name,
  hint,
  ...rest
}: FieldBase & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" {...rest} />
      {hint ? <small className="field-hint">{hint}</small> : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  hint,
  children,
  ...rest
}: FieldBase & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} className="select" {...rest}>
        {children}
      </select>
      {hint ? <small className="field-hint">{hint}</small> : null}
    </div>
  );
}

export function TextareaField({
  label,
  name,
  hint,
  ...rest
}: FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <textarea id={name} name={name} className="input textarea" {...rest} />
      {hint ? <small className="field-hint">{hint}</small> : null}
    </div>
  );
}
