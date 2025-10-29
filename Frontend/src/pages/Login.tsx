import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Mail, Lock, ArrowLeft } from 'lucide-react';
import AuthSidePanel from '@/components/auth/AuthSidePanel';
import { toast } from "@/hooks/use-toast";

// Sign in schema only
const signInSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255),
  password: z.string().min(1, 'Password is required'),
});

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(true);

  if (user) {
    navigate('/');
    return null;
  }

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (Object.keys(form.formState.errors).length > 0) {
      setShowValidationErrors(true);
    }
  }, [form.formState.errors]);

  const onSubmit = async (data: z.infer<typeof signInSchema>) => {
    setIsLoading(true);
    setAuthError(null);
    const res = await signIn(data.email, data.password);
    setIsLoading(false);
    if (!res.success) {
      setAuthError('Incorrect username or password.');
    } else {
      toast({
        description: 'Logged in successfully.'
      });
    }
  };

  return (
    <div className="min-h-screen flex">
      <AuthSidePanel/>
      <div className="flex-1 relative flex items-center justify-center p-8">{/* added relative for absolute back button */}
        {/* Back Button */}
        <Button
          type="button"
          variant="social"
          size="sm"
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 gap-1 text-sm text-muted-foreground hover:text-foreground border-none transition-shadow hover:shadow-md"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="">Back</span>
        </Button>
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-medium tracking-tight">Login To vendorIQ.ai</h2>
            <p className="mt-2 text-sm text-muted-foreground">Welcome back! Please login to your account</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {(showValidationErrors && Object.keys(form.formState.errors).length > 0) || authError ? (
                <div className="relative rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center justify-center">
                  <span className="w-full text-center">Incorrect username or password.</span>
                  <button
                    type="button"
                    onClick={() => { setShowValidationErrors(false); setAuthError(null); }}
                    className="absolute right-2 top-1.5 inline-flex h-7 w-7 items-center justify-center"
                    aria-label="Dismiss error"
                  >
                    <span aria-hidden className="text-xl leading-none">&times;</span>
                  </button>
                </div>
              ) : null}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input {...field} type="email" placeholder="Type your Email" className="pl-10" />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input {...field} type="password" placeholder="••••••••" className="pl-10" />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-end">
                <Link to="/reset" className="text-sm font-medium text-primary hover:underline">Forgot Password?</Link>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} variant="hero">
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              <div className="flex justify-center gap-4">
                <Button
                  variant="social"
                  size="icon"
                  type="button"
                  aria-label="Login with Google"
                  className='w-full'
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    const res = await signInWithGoogle();
                    setIsLoading(false);
                    if (res.success) {
                      toast({ description: 'Logged in with Google.' });
                      navigate('/');
                    } else {
                      toast({ description: res.error || 'Google login failed.' });
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span aria-hidden className="">Continue with Google</span>
                </Button>

              </div>
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{' '}<Link to="/register" className="font-medium text-primary hover:underline">Sign Up</Link>
              </p>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;
