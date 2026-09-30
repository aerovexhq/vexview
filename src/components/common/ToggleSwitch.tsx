import React from 'react';
import styles from './ToggleSwitch.module.css';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}) => {
  return (
    <label className={styles.switch}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.slider} />
    </label>
  );
};
