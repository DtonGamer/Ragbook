import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  CheckCircle,
  File,
  FileText,
  Loader2,
  Upload,
  X
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface DocumentUploadProps {
  onUploadComplete?: () => void;
  className?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
  uploadedAt: Date;
  storagePath?: string;
  documentId?: string;
}

export const DocumentUpload = ({ onUploadComplete, className = "" }: DocumentUploadProps) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return <File className="w-4 h-4 text-red-500" />;
    if (type.includes('text')) return <FileText className="w-4 h-4 text-blue-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = Array.from(selectedFiles).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading',
      progress: 0,
      uploadedAt: new Date()
    }));

    setFiles(prev => [...prev, ...newFiles]);
    uploadFiles(Array.from(selectedFiles), newFiles);
  };

  const uploadFiles = async (fileList: File[], fileObjects: UploadedFile[]) => {
    setIsUploading(true);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileObj = fileObjects[i];

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        console.log('Uploading file:', file.name);

        // Update progress to show upload started
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id ? { ...f, progress: 10 } : f
        ));

        // Generate unique filename
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9\-_.]/g, '_');
        const uniqueFilename = `${timestamp}_${randomSuffix}_${sanitizedName}`;
        const filePath = `${session.user.id}/${uniqueFilename}`;

        // Upload to Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (storageError) {
          throw new Error(`Storage upload failed: ${storageError.message}`);
        }

        console.log('Storage upload successful:', storageData);

        // Update progress after storage upload
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id ? { ...f, progress: 50 } : f
        ));

        // Create entry in documents table
        const { data: documentData, error: dbError } = await supabase
          .from('documents')
          .insert({
            user_id: session.user.id,
            filename: file.name,
            original_name: file.name,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
            storage_path: filePath,
            metadata: {
              uploaded_at: new Date().toISOString(),
              original_name: file.name
            },
            total_chunks: 0,
            processed_chunks: 0
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database insert error:', dbError);
          throw new Error(`Database insert failed: ${dbError.message}`);
        }

        console.log('Database entry created:', documentData);

        // Update file status to completed
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id ? { 
            ...f, 
            status: 'completed', 
            progress: 100,
            storagePath: filePath,
            documentId: documentData.id
          } : f
        ));

        toast.success(`"${file.name}" uploaded successfully`);

      } catch (error: any) {
        console.error('Upload error:', error);
        
        setFiles(prev => prev.map(f => 
          f.id === fileObj.id ? { 
            ...f, 
            status: 'error', 
            progress: 0,
            error: error.message || 'Upload failed'
          } : f
        ));
        
        toast.error(`Failed to upload "${file.name}": ${error.message}`);
      }
    }

    setIsUploading(false);
    onUploadComplete?.();
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (file: UploadedFile) => {
    switch (file.status) {
      case 'uploading':
        return 'Uploading';
      case 'completed':
        return 'Uploaded';
      case 'error':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-colors ${
          isDragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">Upload Documents</h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop files here, or click to select
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Files will be ready for processing after upload
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {acceptedTypes.map(type => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {type.split('/')[1].toUpperCase()}
                </Badge>
              ))}
            </div>

            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full max-w-xs"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Files
                </>
              )}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedTypes.join(',')}
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Queue</CardTitle>
            <CardDescription>
              {files.length} file{files.length !== 1 ? 's' : ''} • {
                files.filter(f => f.status === 'completed').length
              } completed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                <div className="flex-shrink-0">
                  {getFileIcon(file.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(file.status)}>
                        {getStatusIcon(file.status)}
                        <span className="ml-1 capitalize">{getStatusText(file)}</span>
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                    {file.status === 'uploading' && (
                      <div className="flex items-center space-x-2">
                        <Progress value={file.progress} className="w-20 h-2" />
                        <span className="text-xs text-muted-foreground">
                          {file.progress}%
                        </span>
                      </div>
                    )}
                  </div>

                  {file.error && (
                    <p className="text-xs text-red-600 mt-1">{file.error}</p>
                  )}

                  {file.status === 'completed' && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Ready for processing in Documents page
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};