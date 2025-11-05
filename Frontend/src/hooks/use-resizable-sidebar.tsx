import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizableSidebarProps {
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
}

export const useResizableSidebar = ({
  minWidth = 200,
  maxWidth = 400,
  defaultWidth = 280,
}: UseResizableSidebarProps = {}) => {
  const [sidebarWidth, setSidebarWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const animationFrameId = useRef<number>();

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
        
        animationFrameId.current = requestAnimationFrame(() => {
          const newWidth = mouseMoveEvent.clientX;
          if (newWidth >= minWidth && newWidth <= maxWidth) {
            setSidebarWidth(newWidth);
          }
        });
      }
    },
    [isResizing, minWidth, maxWidth]
  );

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', resize, { passive: true });
      document.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      // Prevent text selection during resize
      document.body.style.pointerEvents = 'none';
      document.documentElement.style.pointerEvents = 'auto';
    } else {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
      document.documentElement.style.pointerEvents = '';
      
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    }

    return () => {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
      document.documentElement.style.pointerEvents = '';
      
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isResizing, resize, stopResizing]);

  return {
    sidebarWidth,
    isResizing,
    startResizing,
    stopResizing,
  };
};