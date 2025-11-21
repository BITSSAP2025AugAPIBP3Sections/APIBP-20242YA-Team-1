import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login"; 
import Register from './pages/Register'; 
import Reset from './pages/Reset'; 
import { AuthProvider, useAuth } from "./contexts/AuthContext"; 
import { UserProvider } from "./contexts/UserContext";
import Home from "./pages/Home";
import ProtectedRoutes from "./components/ProtectedRoutes";

const queryClient = new QueryClient();

// Component to handle routes based on authentication status
const AppRoutes = () => {
  const { user } = useAuth();
  
  // For non-authenticated users, show routes without sidebar
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="*" element={<NotFound/>} />
      </Routes>
    );
  }

  // For authenticated users, use the ProtectedRoutes component
  return <ProtectedRoutes />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <AuthProvider>
          <UserProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
            <Toaster />
          </UserProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
