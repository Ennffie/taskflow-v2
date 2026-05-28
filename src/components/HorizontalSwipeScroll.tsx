import { useRef } from 'react';
import type { CSSProperties, PointerEvent, PropsWithChildren, TouchEvent } from 'react';

interface HorizontalSwipeScrollProps extends PropsWithChildren {
  style?: CSSProperties;
}

type DragState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  startScrollLeft: number;
  lockedAxis: 'x' | 'y' | null;
};

const LOCK_THRESHOLD = 8;

export function HorizontalSwipeScroll({ children, style }: HorizontalSwipeScrollProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    lockedAxis: null,
  });

  const resetDrag = () => {
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    dragRef.current.lockedAxis = null;
  };

  const beginDrag = (x: number, y: number, pointerId: number | null) => {
    dragRef.current = {
      active: true,
      pointerId,
      startX: x,
      startY: y,
      startScrollLeft: containerRef.current?.scrollLeft ?? 0,
      lockedAxis: null,
    };
  };

  const moveDrag = (x: number, y: number) => {
    const container = containerRef.current;
    const drag = dragRef.current;
    if (!container || !drag.active) return false;

    const deltaX = x - drag.startX;
    const deltaY = y - drag.startY;

    if (!drag.lockedAxis) {
      if (Math.abs(deltaX) < LOCK_THRESHOLD && Math.abs(deltaY) < LOCK_THRESHOLD) return false;
      drag.lockedAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }

    if (drag.lockedAxis !== 'x' || container.scrollWidth <= container.clientWidth) return false;

    container.scrollLeft = drag.startScrollLeft - deltaX;
    return true;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType === 'touch') return;

    beginDrag(event.clientX, event.clientY, event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    moveDrag(event.clientX, event.clientY);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    beginDrag(touch.clientX, touch.clientY, touch.identifier);
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId === null) return;
    const touch = Array.from(event.touches).find((item) => item.identifier === drag.pointerId);
    if (!touch) return;

    if (moveDrag(touch.clientX, touch.clientY) && event.cancelable) {
      event.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={resetDrag}
      onPointerCancel={resetDrag}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') resetDrag();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={resetDrag}
      onTouchCancel={resetDrag}
      style={{
        width: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y pinch-zoom',
        overscrollBehaviorX: 'contain',
        cursor: 'grab',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
