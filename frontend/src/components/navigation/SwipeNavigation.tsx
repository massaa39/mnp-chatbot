import React from 'react';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';

interface SwipeNavigationProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const SwipeNavigation: React.FC<SwipeNavigationProps> = ({
  onSwipeLeft,
  onSwipeRight,
  children,
  className = '',
}) => {
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
    threshold: 50,
    velocity: 0.3,
  });

  return (
    <div 
      className={`touch-pan-y ${className}`}
      {...swipeHandlers}
    >
      {children}
    </div>
  );
};

export default SwipeNavigation;