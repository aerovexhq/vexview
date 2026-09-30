import React, { useRef, useEffect } from 'react';
import { useViewerStore } from '../stores/useViewerStore';
import styles from './Filmstrip.module.css';

export const Filmstrip: React.FC = () => {
  const { items, currentIndex, selectIndex, showFilmstrip } = useViewerStore();
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active item
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  if (!showFilmstrip || items.length <= 1) return null;

  return (
    <footer className={styles.filmstrip}>
      {items.map((item, idx) => {
        const isActive = idx === currentIndex;
        return (
          <div
            key={item.path}
            ref={isActive ? activeRef : null}
            className={`${styles.thumbItem} ${isActive ? styles.active : ''}`}
            onClick={() => selectIndex(idx)}
            title={item.file_name}
          >
            <div className={styles.badge}>{item.media_type}</div>
          </div>
        );
      })}
    </footer>
  );
};
