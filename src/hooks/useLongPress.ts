import { useRef, useEffect } from "react";

export function useLongPress({
  onLongPress,
  onClick,
  ms = 600,
}: {
  onLongPress: () => void;
  onClick: () => void;
  ms?: number;
}) {
  const timerRef = useRef<any>(null);
  const isLongPressTriggered = useRef(false);

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    isLongPressTriggered.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      onLongPress();
    }, ms);
  };

  const stop = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (!isLongPressTriggered.current) {
      onClick();
    }
  };

  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: stop,
    onTouchEnd: stop,
    onMouseLeave: cancel,
  };
}
