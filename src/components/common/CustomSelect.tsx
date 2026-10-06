import React from 'react';
import { Select, SelectOption } from '../ui/Select';

export type { SelectOption };

export interface CustomSelectProps<T extends string = string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const CustomSelect = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  size = 'md',
}: CustomSelectProps<T>): React.ReactElement => {
  return (
    <Select<T>
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel={ariaLabel}
      className={className}
      size={size}
    />
  );
};
