// filepath: /Users/I528930/venderIQ/Frontend/src/pages/Reset.tsx
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { Mail, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from "@/hooks/use-toast";

const resetSchema = z.object({ email: z.string().email('Invalid email').max(255) });

const Reset = () => {
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (Object.keys(form.formState.errors).length > 0) {
      setShowValidationErrors(true);
    }
  }, [form.formState.errors]);

  const onSubmit = async (data: z.infer<typeof resetSchema>) => {
    setIsLoading(true);
    setServerError(null);
    setSuccessMessage(null);
    const res = await resetPassword(data.email);
    setIsLoading(false);
    if (!res.success) {
      const err = res.error || 'Request failed';
      setServerError(err);
    } else {
      const msg = 'Reset link has been sent.';
      setSuccessMessage(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <Button
        type="button"
        variant="social"
        size="sm"
        onClick={() => navigate(-1)}
        className="absolute left-4 top-4 gap-1 text-sm text-muted-foreground hover:text-foreground border-none transition-shadow hover:shadow-md"
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back</span>
      </Button>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Reset Password</h2>
          <p className="text-sm text-muted-foreground">Enter your email to receive a reset link</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {(showValidationErrors && Object.keys(form.formState.errors).length > 0) || serverError ? (
              <div className="relative rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center justify-center">
                <span className="w-full text-center">{serverError || 'Invalid email address.'}</span>
                <button
                  type="button"
                  onClick={() => { setShowValidationErrors(false); setServerError(null); }}
                  className="absolute right-2 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive"
                  aria-label="Dismiss error"
                >
                  <span aria-hidden className="text-xl leading-none">&times;</span>
                </button>
              </div>
            ) : null}
            {successMessage && (
              <div className="relative rounded-md border border-green-600/40 bg-green-600/10 p-3 text-sm text-green-700 flex items-center justify-center">
                <span className="w-full text-center">{successMessage}</span>
                <button
                  type="button"
                  onClick={() => setSuccessMessage(null)}
                  className="absolute right-2 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded hover:bg-green-600/20 focus:outline-none focus:ring-2 focus:ring-green-600"
                  aria-label="Dismiss success"
                >
                  <span aria-hidden className="text-xl leading-none">&times;</span>
                </button>
              </div>
            )}
            <FormField name="email" control={form.control} render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input {...field} type="email" placeholder="you@example.com" className="pl-10" />
                  </div>
                </FormControl>
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={isLoading} variant="hero">
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">Remembered? <Link to="/login" className="font-medium text-primary hover:underline">Back to login</Link></p>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default Reset;