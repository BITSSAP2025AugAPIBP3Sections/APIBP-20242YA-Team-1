import { Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "./ThemeToggle";
import { useResizableSidebar } from "@/hooks/use-resizable-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect } from "react";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import EmailSync from "@/pages/EmailSync";
import ScheduledJobs from "@/pages/ScheduledJobs";
import Vendors from "@/pages/Vendors";
import Invoices from "@/pages/Invoices";
import NotFound from "@/pages/NotFound";

const ProtectedRoutes = () => {
  const { sidebarWidth, isResizing, startResizing, stopResizing } = useResizableSidebar({
    minWidth: 240,
    maxWidth: 480,
    defaultWidth: 280,
  });

  return (
    <SidebarProvider
      className={isResizing ? '[&_*]:!transition-none' : ''}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <ProtectedLayout
        sidebarWidth={sidebarWidth}
        isResizing={isResizing}
        startResizing={startResizing}
        stopResizing={stopResizing}
      />
    </SidebarProvider>
  );
};

const ProtectedLayout = ({
  sidebarWidth,
  isResizing,
  startResizing,
  stopResizing,
}: {
  sidebarWidth: number;
  isResizing: boolean;
  startResizing: () => void;
  stopResizing: () => void;
}) => {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const isMobile = useIsMobile();

  // Stop any active resize if we switch to mobile
  useEffect(() => {
    if (isMobile && isResizing) {
      stopResizing();
    }
  }, [isMobile, isResizing, stopResizing]);

  return (
    <div className="flex h-screen w-full">
      <div
        className={`relative flex-shrink-0 ${(!isMobile && !isCollapsed) ? 'border-r' : ''} ${isResizing ? 'transition-none' : 'transition-all duration-150'}`}
        // Collapse to 0 only on desktop. On mobile always 0 (Sheet handles overlay)
        style={{ width: isMobile ? 0 : (isCollapsed ? 0 : sidebarWidth) }}
      >
        <AppSidebar />
        {/* Resize handle only when desktop & expanded */}
        {!isMobile && !isCollapsed && (
          <div
            className={`absolute top-0 right-0 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${
              isResizing ? 'bg-primary/30 w-2' : 'w-1'
            }`}
            onMouseDown={startResizing}
            style={{ zIndex: 10 }}
          />
        )}
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between border-b p-5">
          <SidebarTrigger
            data-testid="button-sidebar-toggle"
            onClick={() => {
              if (isResizing) stopResizing();
            }}
          />
            <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/email-sync" element={<EmailSync />} />
              <Route path="/scheduled-jobs" element={<ScheduledJobs />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/register" element={<Navigate to="/" replace />} />
              <Route path="/reset" element={<Navigate to="/" replace />} />
              <Route path="/analytics" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProtectedRoutes;