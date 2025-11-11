import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthProvider";
import { Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  return (
    <div className="min-h-[100svh] flex flex-col bg-background safe-top safe-bottom overflow-x-hidden overflow-y-hidden md:overflow-y-visible">
      <header className="border-b border-border/50 backdrop-blur-sm bg-card/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shadow-sm shadow-primary/20">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">RAG BOOK</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => navigate("/pricing")} 
              className="transition-smooth hover:scale-102 active:scale-98"
            >
              Pricing
            </Button>
            <Button 
              onClick={() => navigate(user ? "/chat" : "/auth")} 
              className="transition-smooth hover:scale-102 active:scale-98"
            >
              {user ? "Go to Chat" : "Get Started"}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-5 pt-12 pb-8 md:px-6 md:py-28">
          <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-center">
            <div className="text-center md:text-left max-w-md mx-auto md:max-w-none md:mx-0">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-foreground">
                Recall faster with an AI that understands your notes
              </h2>
              <p className="text-muted-foreground text-base md:text-lg mb-8 mx-auto md:mx-0 max-w-prose">
                Natural conversation. Clear explanations. Searches your documents only when you ask.
              </p>
              <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
                <Button 
                  size="lg" 
                  onClick={() => navigate(user ? "/chat" : "/auth")} 
                  className="transition-smooth hover:scale-102 active:scale-98"
                >
                  {user ? "Continue chatting" : "Get started — it’s free"}
                </Button>
                {!user && (
                  <Button 
                    size="lg" 
                    variant="outline" 
                    onClick={() => navigate("/auth")} 
                    className="transition-smooth hover:scale-102 active:scale-98"
                  >
                    Sign in
                  </Button>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border/50 bg-card/50 p-6 shadow-sm mx-auto w-full max-w-md md:max-w-none">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="text-sm text-muted-foreground">Preview</div>
              </div>
              <div className="rounded-xl border border-border/50 p-4 bg-background/60">
                <p className="text-sm text-foreground">
                  "Hey! I’m RAG Book — ask me anything. When you say ‘search my documents’, I’ll pull answers from your notes."
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} RAG BOOK
      </footer>
    </div>
  );
};

export default Home;


