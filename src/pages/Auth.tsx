import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MobileInput } from "@/components/ui/mobile-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Turnstile } from '@marsidev/react-turnstile';
import { ArrowLeft, Bot } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Use dummy sitekey for development, real key for production
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>("");
  const [turnstileKey, setTurnstileKey] = useState(0); // For resetting Turnstile

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    if (!captchaToken) {
      toast.error("Please complete the CAPTCHA verification");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken,
      });

      if (error) throw error;

      toast.success("Password reset email sent! Check your inbox.");
      setShowForgotPassword(false);
      setCaptchaToken("");
      setTurnstileKey(prev => prev + 1); // Reset captcha
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
      setCaptchaToken("");
      setTurnstileKey(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!captchaToken) {
      toast.error("Please complete the CAPTCHA verification");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          captchaToken,
        },
      });

      if (error) throw error;

      toast.success("Account created! Please verify your email.");
      setCaptchaToken("");
      setTurnstileKey(prev => prev + 1); // Reset captcha
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
      setCaptchaToken("");
      setTurnstileKey(prev => prev + 1); // Reset captcha on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!captchaToken) {
      toast.error("Please complete the CAPTCHA verification");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken,
        },
      });

      if (error) throw error;

      toast.success("Welcome back!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
      setCaptchaToken("");
      setTurnstileKey(prev => prev + 1); // Reset captcha on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[var(--gradient-mesh)] opacity-50"></div>
      
      <div className="w-full max-w-md mx-4 my-8 relative z-10">
        <Card className="border-border/50 backdrop-blur-sm bg-card/80 transition-smooth hover:shadow-lg">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2 shadow-sm shadow-primary/20">
              <Bot className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              RAG BOOK
            </CardTitle>
            <CardDescription className="text-sm md:text-base">
              Intelligent answers powered by AI and vector search
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                {showForgotPassword ? (
                  <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email" className="text-sm font-medium">Email</Label>
                      <MobileInput
                        id="reset-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        required
                        className="transition-smooth"
                      />
                    </div>

                    {/* Turnstile CAPTCHA */}
                    <div className="flex justify-center">
                      <Turnstile
                        key={`forgot-${turnstileKey}`}
                        siteKey={TURNSTILE_SITE_KEY}
                        onSuccess={(token) => setCaptchaToken(token)}
                        onError={() => {
                          setCaptchaToken("");
                          toast.error("CAPTCHA verification failed. Please try again.");
                        }}
                        onExpire={() => {
                          setCaptchaToken("");
                          toast.warning("CAPTCHA expired. Please verify again.");
                        }}
                        options={{
                          theme: 'dark',
                          size: 'normal',
                        }}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full transition-smooth hover:scale-102 active:scale-98" 
                      disabled={isLoading || !captchaToken}
                    >
                      {isLoading ? "Sending..." : "Send Reset Link"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full transition-smooth hover:scale-102 active:scale-98"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setCaptchaToken("");
                        setTurnstileKey(prev => prev + 1);
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Sign In
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-sm font-medium">Email</Label>
                      <MobileInput
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        required
                        className="transition-smooth"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password" className="text-sm font-medium">Password</Label>
                      <MobileInput
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        required
                        className="transition-smooth"
                      />
                    </div>

                    {/* Turnstile CAPTCHA */}
                    <div className="flex justify-center">
                      <Turnstile
                        key={`signin-${turnstileKey}`}
                        siteKey={TURNSTILE_SITE_KEY}
                        onSuccess={(token) => setCaptchaToken(token)}
                        onError={() => {
                          setCaptchaToken("");
                          toast.error("CAPTCHA verification failed. Please try again.");
                        }}
                        onExpire={() => {
                          setCaptchaToken("");
                          toast.warning("CAPTCHA expired. Please verify again.");
                        }}
                        options={{
                          theme: 'dark',
                          size: 'normal',
                        }}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full transition-smooth hover:scale-102 active:scale-98" 
                      disabled={isLoading || !captchaToken}
                    >
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-sm text-muted-foreground transition-smooth hover:scale-102 active:scale-98"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setCaptchaToken("");
                        setTurnstileKey(prev => prev + 1);
                      }}
                    >
                      Forgot password?
                    </Button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                    <MobileInput
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      className="transition-smooth"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                    <MobileInput
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      minLength={6}
                      className="transition-smooth"
                    />
                  </div>

                  {/* Turnstile CAPTCHA */}
                  <div className="flex justify-center">
                    <Turnstile
                      key={`signup-${turnstileKey}`}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onError={() => {
                        setCaptchaToken("");
                        toast.error("CAPTCHA verification failed. Please try again.");
                      }}
                      onExpire={() => {
                        setCaptchaToken("");
                        toast.warning("CAPTCHA expired. Please verify again.");
                      }}
                      options={{
                        theme: 'dark',
                        size: 'normal',
                      }}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full transition-smooth hover:scale-102 active:scale-98" 
                    disabled={isLoading || !captchaToken}
                  >
                    {isLoading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;