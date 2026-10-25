import React from 'react';
import { Select as StrataSelect } from '@aerovex/strata-ui';

export interface SelectOption<T = any> {
  value: T;
  label: string;
  description?: string;
  subtitle?: string;
  badge?: string;
  disabled?: boolean;
}

export interface SelectProps<T = any> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  searchable?: boolean;
  title?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  placement?: 'down' | 'up' | 'auto';
  menuWidth?: number | string;
}

export function Select<T = any>({
  value,
  options,
  onChange,
  ariaLabel,
  title,
  className,
}: SelectProps<T>): React.ReactElement {
  const strataOptions = options.map((o) => ({
    value: String(o.value),
    label: o.label,
    subtitle: o.description || o.subtitle,
    badge: o.badge,
    disabled: o.disabled,
  }));

  const selectedOpt = options.find((o) => o.value === value);

  return (
    <StrataSelect
      value={String(value ?? '')}
      onValueChange={(nextVal) => {
        const found = options.find((o) => String(o.value) === nextVal);
        if (found) {
          onChange(found.value);
        } else {
          onChange(nextVal as unknown as T);
        }
      }}
      options={strataOptions}
      label={ariaLabel || title || selectedOpt?.label || 'Select'}
      className={className}
    />
  );
}
