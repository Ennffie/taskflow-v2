import { useRef } from 'react';
import type { CSSProperties, PointerEvent, PropsWithChildren } from 'react';

interface HorizontalSwipeScrollProps extends PropsWithChildren {
  style?: CSSProperties;
}

type DragState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startScrollLeft: number;
};

export function HorizontalSwipeScroll({ children, style }: HorizontalSwipeScrollProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>({
    active: false,
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
  });

  const resetDrag = () => {
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
  };

  const beginDrag = (x: number, pointerId: number | null) => {
    dragRef.current = {
      active: true,
      pointerId,
      startX: x,
      startScrollLeft: containerRef.current?.scrollLeft ?? 0,
    };
  };

  const moveDrag = (x: number) => {
    const container = containerRef.current;
    const drag = dragRef.current;
    if (!container || !drag.active) return false;
    if (container.scrollWidth <= container.clientWidth) return false;

    container.scrollLeft = drag.startScrollLeft - (x - drag.startX);
    return true;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType === 'touch') return;

    beginDrag(event.clientX, event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    moveDrag(event.clientX);
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
        touchAction: 'auto',
        overscrollBehaviorX: 'contain',
        cursor: 'grab',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
