import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Search, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AdminDocument {
  id: string;
  name: string;
  email: string;
  size: number;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
  chunk_count?: number;
  processed_pages?: number;
}

export default function AdminDocuments() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        // Fetch documents
        const { data: documentsData, error: documentsError } = await supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (documentsError) {
          console.error('Error fetching documents:', documentsError);
          toast.error('Failed to load documents');
          return;
        }

        if (documentsData) {
          // Get unique user IDs
          const userIds = [...new Set(documentsData.map(doc => doc.user_id))];
          
          // Fetch user emails from user_roles
          const { data: userRoles, error: userError } = await supabase
            .from('user_roles')
            .select('user_id, email')
            .in('user_id', userIds);

          if (userError) {
            console.error('Error fetching user emails:', userError);
          }

          // Create a map of user emails
          const userEmailMap = new Map(
            userRoles?.map(ur => [ur.user_id, ur.email]) || []
          );

          // Format documents with user emails
          const formattedDocuments: AdminDocument[] = documentsData.map(doc => ({
            id: doc.id,
            name: doc.filename || doc.original_name,
            email: userEmailMap.get(doc.user_id) || 'Unknown User',
            size: doc.file_size,
            type: doc.mime_type,
            status: doc.status,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            chunk_count: doc.chunk_count || doc.total_chunks || 0,
            processed_pages: doc.processed_chunks,
          }));
          
          setDocuments(formattedDocuments);
        }
      } catch (error) {
        console.error('Unexpected error fetching documents:', error);
        toast.error('Failed to load documents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, []);

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

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'queued':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ResponsiveLayout showSidebar={false}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 lg:px-6 py-3 flex-shrink-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin")}
                className="transition-smooth hover:scale-102 active:scale-98"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin
              </Button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Document Management
              </h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6 lg:py-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents by name, user, or status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Documents Table */}
            <Card>
              <CardHeader>
                <CardTitle>Documents ({filteredDocuments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Chunks</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-primary" />
                              {doc.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            {doc.email}
                          </TableCell>
                          <TableCell>
                            {formatFileSize(doc.size)}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(doc.status)}`}>
                              {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {doc.chunk_count || 0}
                          </TableCell>
                          <TableCell>
                            {formatDate(doc.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
}