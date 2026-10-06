import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './Select.css';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  description?: string;
  icon?: React.ReactNode;
}

export interface SelectProps<T> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  title?: string;
  placement?: 'up' | 'down' | 'auto';
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
  menuWidth?: number | string;
  searchable?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Select<T>({
  value,
  options,
  onChange,
  className = '',
  title,
  placement = 'auto',
  size = 'md',
  style,
  menuWidth,
  searchable = false,
  disabled = false,
  ariaLabel,
}: SelectProps<T>): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption =
    options.find((opt) => opt.value === value && !opt.disabled) ||
    options.find((opt) => opt.value === value) ||
    options.find((opt) => !opt.disabled) ||
    options[0];

  const displayedOptions =
    searchable && searchQuery.trim().length > 0
      ? options.filter((o) =>
          o.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : options;

  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedHeight = Math.min(280, Math.max(1, displayedOptions.length) * (size === 'sm' ? 28 : 34) + 12);

    let actualPlacement: 'up' | 'down' = 'down';
    if (placement === 'up') {
      actualPlacement = 'up';
    } else if (placement === 'down') {
      actualPlacement = 'down';
    } else {
      // Auto: check if overflowing bottom
      if (rect.bottom + estimatedHeight + 8 > window.innerHeight && rect.top > window.innerHeight - rect.bottom) {
        actualPlacement = 'up';
      } else {
        actualPlacement = 'down';
      }
    }

    const minW = typeof menuWidth === 'number'
      ? menuWidth
      : Math.max(rect.width, size === 'sm' ? 80 : 130);
    const maxW = Math.min(360, window.innerWidth - 16);

    let leftPos = rect.left;
    if (leftPos + (typeof minW === 'number' ? minW : 140) > window.innerWidth - 8) {
      leftPos = Math.max(8, window.innerWidth - (typeof minW === 'number' ? minW : 140) - 8);
    }

    setDropdownStyle({
      position: 'fixed',
      top: actualPlacement === 'up' ? undefined : rect.bottom + 4,
      bottom: actualPlacement === 'up' ? window.innerHeight - rect.top + 4 : undefined,
      left: Math.max(8, leftPos),
      minWidth: typeof menuWidth === 'string' ? menuWidth : `${minW}px`,
      maxWidth: `${maxW}px`,
      width: menuWidth ? (typeof menuWidth === 'number' ? `${menuWidth}px` : menuWidth) : 'max-content',
      zIndex: 999999,
      transformOrigin: actualPlacement === 'up' ? 'bottom center' : 'top center',
    });
  }, [placement, size, menuWidth, displayedOptions.length]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updateDropdownPosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    updateDropdownPosition();

    const handlePointerDownOutside = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleWindowResizeOrScroll = (event: Event) => {
      if (dropdownRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    window.addEventListener('resize', handleWindowResizeOrScroll);
    document.addEventListener('wheel', handleWindowResizeOrScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      window.removeEventListener('resize', handleWindowResizeOrScroll);
      document.removeEventListener('wheel', handleWindowResizeOrScroll, { capture: true });
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    const firstEnabledIndex = displayedOptions.findIndex((o) => !o.disabled);
    setFocusedIndex(firstEnabledIndex >= 0 ? firstEnabledIndex : 0);
  }, [searchQuery, isOpen, displayedOptions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        toggleOpen();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => {
        let next = prev + 1;
        while (next < displayedOptions.length && displayedOptions[next]?.disabled) {
          next++;
        }
        return next < displayedOptions.length ? next : prev;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => {
        let next = prev - 1;
        while (next >= 0 && displayedOptions[next]?.disabled) {
          next--;
        }
        return next >= 0 ? next : prev;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = displayedOptions[focusedIndex];
      if (selected && !selected.disabled) {
        onChange(selected.value);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleSelectOption = (opt: SelectOption<T>) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      className={`custom-select size-${size} ${disabled ? 'disabled' : ''} ${className}`}
      style={style}
      title={title}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || title}
        disabled={disabled}
      >
        <span className="custom-select-trigger-label">
          {selectedOption ? selectedOption.label : String(value ?? '')}
        </span>
        <svg
          className="custom-select-chevron"
          width={size === 'sm' ? 10 : 12}
          height={size === 'sm' ? 10 : 12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`custom-select-dropdown size-${size}`}
            style={dropdownStyle}
            role="listbox"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
          >
            {searchable && (
              <div className="custom-select-search-container">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Filter..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="custom-select-search-input"
                />
              </div>
            )}

            {displayedOptions.length > 0 ? (
              displayedOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isFocused = idx === focusedIndex;

                return (
                  <div
                    key={`${String(opt.value)}-${idx}`}
                    className={`custom-select-option ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''} ${opt.disabled ? 'disabled' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectOption(opt);
                    }}
                    role="option"
                    aria-selected={isSelected}
                    title={opt.description || opt.label}
                  >
                    <span className="custom-select-option-label">{opt.label}</span>
                    {isSelected && (
                      <svg
                        className="custom-select-check-icon"
                        width={size === 'sm' ? 11 : 12}
                        height={size === 'sm' ? 11 : 12}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="custom-select-empty">No options</div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
