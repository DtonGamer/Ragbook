import { DocumentUpload } from "@/components/DocumentUpload";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { MobileInput } from "@/components/ui/mobile-input";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useDocumentStatus } from "@/hooks/useDocumentStatus";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Calendar,
  File,
  FileText,
  HardDrive,
  Loader2,
  Search,
  Upload,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DocumentGrid } from "../components/DocumentGrid";

export interface Document {
  id: string;
  name: string;
  size: number;
  type: string;
  created_at: string;
  updated_at: string;
  status?: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'partial';
  status_message?: string;
  chunk_count?: number;
  needs_ocr?: boolean;
  storage_path: string;
  error_message?: string;
  processing_started_at?: string;
  processing_completed_at?: string;
}

const Documents = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const { confirm, cancel, handleConfirm, confirmationState } = useConfirmation();
  
  // Use realtime document status updates
  useDocumentStatus();

  useEffect(() => {
    loadDocuments();
    
    // Set up realtime subscription for processing status updates
    let channel: RealtimeChannel | null = null;

    const setupRealtimeSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      channel = supabase
        .channel('document-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'documents',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload) => {
            console.log('Document status changed:', payload);
            loadDocuments(true);
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();
    
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const loadDocuments = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Get documents from database with new schema
      const { data: dbDocuments, error: dbError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (dbError) {
        console.error('Error loading documents:', dbError);
        if (!silent) toast.error('Failed to load documents');
        return;
      }

      // Map to Document interface
      const documentsWithMetadata: Document[] = (dbDocuments || []).map(doc => ({
        id: doc.id,
        name: doc.title || doc.filename,
        size: doc.file_size,
        type: doc.mime_type,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        storage_path: doc.storage_path,
        status: doc.status || 'pending',
        status_message: doc.status_message,
        chunk_count: doc.chunk_count,
        needs_ocr: doc.needs_ocr,
        error_message: doc.error_message,
        processing_started_at: doc.processing_started_at,
        processing_completed_at: doc.processing_completed_at
      }));

      setDocuments(documentsWithMetadata);
    } catch (error) {
      console.error('Error loading documents:', error);
      if (!silent) toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const processDocument = async (docId: string) => {
    setProcessingDocId(docId);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        setProcessingDocId(null);
        return;
      }

      console.log('Submitting document for processing:', docId);

      // Call the new submit-document Edge Function
      const { data, error } = await supabase.functions.invoke('submit-document', {
        body: { document_id: docId }
      });

      console.log('Submit response:', { data, error });

      if (error) {
        console.error('Submit error:', error);
        toast.error(`Failed to queue document: ${error.message}`);
        setProcessingDocId(null);
        return;
      }

      if (!data || !data.success) {
        const errorMsg = data?.error || 'Failed to queue document';
        console.error('Queue failed:', errorMsg);
        toast.error(errorMsg);
        setProcessingDocId(null);
        return;
      }

      toast.success('Document queued for processing! Watch for real-time updates.');
      
      // Reload documents to show updated status
      await loadDocuments(true);
    } catch (error: any) {
      console.error('Error submitting document:', error);
      toast.error(`Failed to queue: ${(error as Error).message || 'Unknown error'}`);
    } finally {
      setProcessingDocId(null);
    }
  };

  const processAllDocuments = async () => {
    const readyDocs = documents.filter(doc => doc.status === 'pending' || !doc.status);
    
    if (readyDocs.length === 0) {
      toast.info('No documents ready for processing');
      return;
    }

    const confirmed = await confirm({
      title: "Process All Documents",
      description: `This will queue ${readyDocs.length} document${readyDocs.length !== 1 ? 's' : ''} for processing. Continue?`,
      confirmText: "Process All",
      cancelText: "Cancel",
      variant: "default",
      icon: "zap"
    });

    if (!confirmed) return;

    setIsProcessingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const doc of readyDocs) {
      try {
        await processDocument(doc.id);
        successCount++;
        // Small delay between submissions
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to queue ${doc.name}:`, error);
        failCount++;
      }
    }

    setIsProcessingAll(false);
    
    if (successCount > 0) {
      toast.success(`Queued ${successCount} document${successCount !== 1 ? 's' : ''} for processing`);
    }
    if (failCount > 0) {
      toast.error(`Failed to queue ${failCount} document${failCount !== 1 ? 's' : ''}`);
    }
  };

  const deleteDocument = async (documentId: string, documentName: string, storagePath: string) => {
    const confirmed = await confirm({
      title: "Delete Document",
      description: `Are you sure you want to delete "${documentName}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
      icon: "trash"
    });

    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([storagePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue even if storage delete fails
      }

      // Delete from knowledge base using document_id
      const { error: knowledgeBaseError } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('document_id', documentId);

      if (knowledgeBaseError) {
        console.error('Knowledge base delete error:', knowledgeBaseError);
        // Continue even if knowledge base delete fails
      }

      // Delete document record (this will cascade delete related records)
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', session.user.id);

      if (deleteError) {
        throw deleteError;
      }

      toast.success('Document deleted successfully');
      loadDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast.error(`Failed to delete document: ${error.message}`);
    }
  };

  const downloadDocument = async (storagePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(storagePath);

      if (error) {
        throw error;
      }

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Document downloaded');
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast.error(`Failed to download: ${error.message}`);
    }
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return <File className="w-5 h-5 text-red-500" />;
    if (type.includes('text')) return <FileText className="w-5 h-5 text-blue-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (doc: Document) => {
    // Check if this specific document is currently being processed
    const isProcessing = processingDocId === doc.id;
    
    if (isProcessing || doc.status === 'processing') {
      return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing...</Badge>;
    }
    
    if (doc.status === 'queued') {
      return <Badge className="bg-purple-100 text-purple-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Queued...</Badge>;
    }
    
    switch (doc.status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">✓ Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">✗ Failed</Badge>;
      case 'partial':
        return <Badge className="bg-orange-100 text-orange-800">⚠ Partial</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (showUpload) {
    return (
      <ResponsiveLayout showSidebar={false} allowScrolling={true}>
        <div className="bg-background">
          <header className="border-b border-border/50 backdrop-blur-sm bg-card/50 sticky top-0 z-10">
            <div className="container-responsive h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUpload(false)}
                  className="transition-smooth hover:scale-102 active:scale-98"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Documents
                </Button>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shadow-sm shadow-primary/20">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Upload Documents
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Add new documents to your knowledge base
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="container-responsive py-8 max-w-4xl">
            <DocumentUpload onUploadComplete={() => {
              setShowUpload(false);
              loadDocuments();
            }} />
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout showSidebar={false} allowScrolling={true}>
      <div className="bg-background">
        <header className="border-b border-border/50 backdrop-blur-sm bg-card/50 sticky top-0 z-10 safe-top">
          <div className="container-responsive h-16 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/chat")}
                className="transition-smooth hover:scale-102 active:scale-98 flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Back to Chat</span>
              </Button>

              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shadow-sm shadow-primary/20 flex-shrink-0">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent truncate">
                  My Documents
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  Manage your uploaded documents
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button 
                onClick={() => setShowUpload(true)}
                size="sm"
                className="transition-smooth hover:scale-102 active:scale-98"
              >
                <Upload className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="container-responsive py-8 max-w-6xl">
          <nav className="flex items-center space-x-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
            <button 
              onClick={() => navigate("/chat")}
              className="hover:text-foreground transition-smooth"
            >
              Chat
            </button>
            <span>/</span>
            <span className="text-foreground">Documents</span>
          </nav>

          {/* Quick Stats */}
          {documents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
                      <p className="text-2xl font-bold">{documents.length}</p>
                    </div>
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Knowledge Chunks</p>
                      <p className="text-2xl font-bold">
                        {documents.reduce((sum, doc) => sum + (doc.chunk_count || 0), 0)}
                      </p>
                    </div>
                    <HardDrive className="w-8 h-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Size</p>
                      <p className="text-2xl font-bold">
                        {formatFileSize(documents.reduce((sum, doc) => sum + doc.size, 0))}
                      </p>
                    </div>
                    <HardDrive className="w-8 h-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Last Upload</p>
                      <p className="text-lg font-bold">
                        {documents.length > 0 ? formatDate(documents[0].created_at) : 'Never'}
                      </p>
                    </div>
                    <Calendar className="w-8 h-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search */}
          <div className="space-y-4 mb-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <MobileInput
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 w-full flex-wrap">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRefreshing(true);
                  loadDocuments(true);
                }}
                disabled={isRefreshing}
                className="flex-1 sm:flex-none"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span className="hidden sm:inline">Refreshing...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Refresh</span>
                  </>
                )}
              </Button>
              {documents.filter(doc => doc.status === 'pending' || !doc.status).length > 0 && (
                <Button 
                  onClick={processAllDocuments}
                  disabled={isProcessingAll}
                  variant="secondary"
                  className="flex-1 sm:flex-none"
                >
                  {isProcessingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Processing All...</span>
                      <span className="sm:hidden">Processing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Process All</span>
                      <span className="sm:hidden">All</span>
                    </>
                  )}
                </Button>
              )}
              <Button 
                onClick={() => setShowUpload(true)}
                className="flex-1 sm:flex-none"
              >
                <Upload className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            </div>
          </div>

          {/* Documents Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <File className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">
                  {searchQuery ? 'No documents found' : 'No documents yet'}
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-6">
                  {searchQuery 
                    ? 'Try adjusting your search terms'
                    : 'Upload your first document to get started'
                  }
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowUpload(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Documents
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <DocumentGrid
              documents={filteredDocuments}
              onProcess={processDocument}
              onDelete={deleteDocument}
              onDownload={downloadDocument}
              onRetry={processDocument}
              processingDocId={processingDocId}
            />
          )}
        </div>

        <ConfirmationDialog
          open={confirmationState.open}
          onOpenChange={cancel}
          onConfirm={handleConfirm}
          title={confirmationState.title}
          description={confirmationState.description}
          confirmText={confirmationState.confirmText}
          cancelText={confirmationState.cancelText}
          variant={confirmationState.variant}
          icon={confirmationState.icon}
        />
      </div>
    </ResponsiveLayout>
  );
};

export default Documents;