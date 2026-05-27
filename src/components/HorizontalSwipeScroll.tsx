import { useRef } from 'react';
import type { CSSProperties, PointerEvent, PropsWithChildren } from 'react';

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

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: containerRef.current?.scrollLeft ?? 0,
      lockedAxis: null,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const drag = dragRef.current;
    if (!container || !drag.active || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (!drag.lockedAxis) {
      if (Math.abs(deltaX) < LOCK_THRESHOLD && Math.abs(deltaY) < LOCK_THRESHOLD) return;
      drag.lockedAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }

    if (drag.lockedAxis === 'x') {
      container.scrollLeft = drag.startScrollLeft - deltaX;
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
