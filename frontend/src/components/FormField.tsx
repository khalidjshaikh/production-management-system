import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, required, error, hint, className = '', children }: FormFieldProps) {
  return (
    <div className={`form-field ${error ? 'has-error' : ''} ${className}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required && <span className="required-mark">*</span>}
      </label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
