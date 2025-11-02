import { Bot, ChevronLeft, ChevronRight, Menu, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  showSidebar?: boolean;
  onNewConversation?: () => void;
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  allowScrolling?: boolean; // When true, allows scrolling instead of fixed height
}

export function ResponsiveLayout({ 
  children, 
  sidebar,
  showSidebar = true,
  onNewConversation,
  sidebarCollapsed = false,
  onSidebarCollapsedChange,
  allowScrolling = false
}: ResponsiveLayoutProps) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [internalCollapsed, setInternalCollapsed] = useState(sidebarCollapsed);

  // CRITICAL FIX: Force expanded state on mobile
  const effectiveCollapsed = isMobile ? false : (onSidebarCollapsedChange ? sidebarCollapsed : internalCollapsed);
  const setCollapsed = onSidebarCollapsedChange || setInternalCollapsed;

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      
      // Force expanded state when switching to mobile
      if (mobile && effectiveCollapsed) {
        setCollapsed(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [effectiveCollapsed, setCollapsed]);

  useEffect(() => {
    if (isMobileMenuOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen, isMobile]);

  useEffect(() => {
    if (!isMobile) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobile]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNewConversation = () => {
    console.log('🆕 New conversation button clicked', { onNewConversation: !!onNewConversation });
    if (onNewConversation) {
      onNewConversation();
      if (isMobile) {
        setIsMobileMenuOpen(false);
      }
    } else {
      console.error('❌ onNewConversation is not defined');
    }
  };

  return (
    <div className={allowScrolling ? "relative bg-background" : "relative h-screen overflow-hidden bg-background"}>
      {/* Mobile Header - Only shown on small screens */}
      {isMobile && showSidebar && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border/50 h-16 safe-top">
          <div className="flex items-center justify-between p-4 h-full">
            <button
              onClick={toggleMobileMenu}
              className="
                p-2 rounded-lg
                transition-smooth-fast
                hover:bg-accent
                active:scale-98
                touch-manipulation
              "
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 transition-smooth hover:opacity-80 active:scale-98 touch-manipulation"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shadow-sm shadow-primary/20">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                RAG BOOK
              </h1>
            </button>
            {onNewConversation && (
              <button
                onClick={handleNewConversation}
                className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors touch-manipulation active:scale-95"
                aria-label="New conversation"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>
      )}

      {/* Desktop Header - Only shown on desktop */}
      {!isMobile && showSidebar && (
        <header className={`fixed top-0 right-0 z-40 bg-card/50 backdrop-blur-sm border-b border-border/50 h-16 transition-all duration-300 ${effectiveCollapsed ? 'left-20' : 'left-80'}`}>
          <div className="flex items-center justify-center px-6 h-full relative">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-3 transition-smooth hover:opacity-80 active:scale-98"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shadow-sm shadow-primary/20">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                RAG BOOK
              </h1>
            </button>
            {onNewConversation && (
              <button
                onClick={onNewConversation}
                className="absolute right-6 inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 font-medium"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            )}
          </div>
        </header>
      )}

      {/* Backdrop for mobile menu */}
      {isMobileMenuOpen && isMobile && (
        <div
          className="
            fixed inset-0 z-40 bg-black/60
            transition-opacity duration-300
            backdrop-blur-sm
          "
          onClick={toggleMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      {showSidebar && sidebar && (
        <aside
          className={`
            fixed top-0 left-0 z-50 bg-background border-r border-border
            transition-all duration-300 ease-out
            h-full
            safe-top safe-bottom safe-left
            ${isMobile ? 'w-80' : (effectiveCollapsed ? 'w-20' : 'w-80')}
            ${
              isMobile
                ? isMobileMenuOpen
                  ? 'translate-x-0'
                  : '-translate-x-full'
                : 'translate-x-0'
            }
          `}
        >
          <div className="h-full flex flex-col relative">
            {/* Desktop Collapse Button - Hidden on mobile */}
            {!isMobile && (
              <div className="absolute -right-5 top-24 z-[60]">
                <button
                  onClick={() => setCollapsed(!effectiveCollapsed)}
                  className="group relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 flex items-center justify-center hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 hover:scale-105 active:scale-95 border border-primary/30"
                  aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  title={effectiveCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
                >
                  {/* Glossy overlay */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Icon */}
                  {effectiveCollapsed ? (
                    <ChevronRight className="w-5 h-5 text-primary-foreground relative z-10 drop-shadow-sm" />
                  ) : (
                    <ChevronLeft className="w-5 h-5 text-primary-foreground relative z-10 drop-shadow-sm" />
                  )}
                  
                  {/* Pulse ring on hover */}
                  <div className="absolute inset-0 rounded-xl border-2 border-primary/50 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />
                  
                  {/* Glow effect */}
                  <div className="absolute inset-0 rounded-xl bg-primary/30 blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
                </button>
              </div>
            )}
            {sidebar}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main
        className={`
          ${allowScrolling ? "min-h-screen" : "h-screen overflow-hidden"}
          transition-all duration-300 ease-out
          ${showSidebar && isMobile ? 'pt-16' : ''}
          ${showSidebar && !isMobile ? 'pt-16' : ''}
          ${showSidebar && !isMobile ? (effectiveCollapsed ? 'lg:ml-20' : 'lg:ml-80') : ''}
        `}
      >
        <div className={`${allowScrolling ? "min-h-screen safe-bottom" : "h-full safe-bottom"}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
