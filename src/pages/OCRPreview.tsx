import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { useAuthContext } from "@/contexts/AuthProvider";
import { ArrowLeft, FileText, Image, Upload } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const OCRPreview = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuthContext();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will be redirected by useEffect
  }

  return (
    <ResponsiveLayout showSidebar={false}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 lg:px-6 py-3 flex-shrink-0">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="transition-smooth hover:scale-102 active:scale-98"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                OCR Preview
              </h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6 lg:py-8 custom-scrollbar">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Image className="w-5 h-5" />
                      Original Image
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Image className="w-16 h-16 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Scanned document preview</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Extracted Text
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted rounded-lg p-4 h-64 overflow-y-auto">
                      <p className="text-sm leading-relaxed">
                        This is a preview of the text extracted from your scanned document using OCR technology. 
                        The text will be processed and added to your knowledge base for AI-powered search and analysis.
                      </p>
                      <p className="text-sm leading-relaxed mt-2">
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <div className="mt-8 flex justify-center gap-4">
              <Button 
                onClick={() => navigate("/documents")}
                className="transition-smooth hover:scale-102 active:scale-98"
              >
                <Upload className="w-4 h-4 mr-2" />
                Process Document
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate("/documents")}
                className="transition-smooth hover:scale-102 active:scale-98"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default OCRPreview;