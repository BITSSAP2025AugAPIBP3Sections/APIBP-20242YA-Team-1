import {
  LayoutDashboard,
  FileText,
  Building2,
  BarChart3,
  Settings,
  ChevronsUpDown, 
  LogOut,
  LifeBuoy,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRef, useState } from "react";

const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Invoices",
    url: "/invoices",
    icon: FileText,
  },
  {
    title: "Vendors",
    url: "/vendors",
    icon: Building2,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
];

const secondaryMenuItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  const handleLogout = () => {
    signOut();
    navigate("/login");
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">vendorIQ.ai</h1>
            <p className="text-xs text-muted-foreground">Smart Invoice Management</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                  >
                    <Link to={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Other</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                  >
                    <Link to={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent> 
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className=" p-2">
        <DropdownMenu.Root onOpenChange={setIsDropdownOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              ref={triggerRef}
              type="button"
              className={`flex w-full items-center gap-3 rounded-md p-2 transition-colors cursor-pointer ${isDropdownOpen ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {(user?.username?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{user?.username}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            side="top"
            align="start"
            sideOffset={6}
            style={{ width: triggerRef.current ? triggerRef.current.offsetWidth : undefined }}
            className="z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          >
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-base font-medium">
                {(user?.username?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user?.username}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <div className="space-y-1">
              <DropdownMenu.Item
                onSelect={(e) => { e.preventDefault(); navigate('/contact'); }}
                className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-2 text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LifeBuoy className="h-4 w-4" />
                <span>Contact Us</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={(e) => { e.preventDefault(); handleLogout(); }}
                className="flex items-center gap-2 cursor-pointer rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </DropdownMenu.Item>  
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </SidebarFooter>
    </Sidebar>
  );
}
