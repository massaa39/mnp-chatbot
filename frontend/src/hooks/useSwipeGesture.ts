import { useRef, useCallback } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;  // 最小距離（px）
  velocity?: number;   // 最小速度（px/ms）
  preventScroll?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export const useSwipeGesture = (options: SwipeGestureOptions = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocity = 0.3,
    preventScroll = false
  } = options;

  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    touchEnd.current = null;

    if (preventScroll) {
      e.preventDefault();
    }
  }, [preventScroll]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (preventScroll) {
      e.preventDefault();
    }
  }, [preventScroll]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;

    const touch = e.changedTouches[0];
    touchEnd.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };

    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;
    const deltaTime = touchEnd.current.time - touchStart.current.time;

    // 距離と速度を計算
    const distanceX = Math.abs(deltaX);
    const distanceY = Math.abs(deltaY);
    const velocityX = distanceX / deltaTime;
    const velocityY = distanceY / deltaTime;

    // 閾値を満たしているかチェック
    if (distanceX < threshold && distanceY < threshold) return;
    if (velocityX < velocity && velocityY < velocity) return;

    // 水平方向のスワイプが優勢
    if (distanceX > distanceY) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    // 垂直方向のスワイプが優勢
    else {
      if (deltaY > 0 && onSwipeDown) {
        onSwipeDown();
      } else if (deltaY < 0 && onSwipeUp) {
        onSwipeUp();
      }
    }

    // リセット
    touchStart.current = null;
    touchEnd.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, velocity]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};

export default useSwipeGesture;