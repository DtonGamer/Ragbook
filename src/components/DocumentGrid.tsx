import { DocumentCard } from "@/components/DocumentCard";
import { ResponsiveGrid } from "@/components/ResponsiveGrid";
import { Document } from "@/pages/Documents"; // Now this will work since Document is exported
import { memo } from "react";

interface DocumentGridProps {
  documents: Document[];
  onProcess: (id: string) => void;
  onDelete: (documentId: string, documentName: string, storagePath: string) => void;
  onDownload: (storagePath: string, fileName: string) => void;
  onRetry: (id: string) => void;
  processingDocId: string | null;
}

export const DocumentGrid = memo(({ 
  documents, 
  onProcess, 
  onDelete, 
  onDownload, 
  onRetry,
  processingDocId
}: DocumentGridProps) => {
  // Create adapter functions that match DocumentCard expected signatures
  const handleDelete = (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (doc) {
      onDelete(doc.id, doc.name, doc.storage_path);
    }
  };

  const handleDownload = (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (doc) {
      onDownload(doc.storage_path, doc.name);
    }
  };

  return (
    <ResponsiveGrid cols={{ sm: 1, md: 2, lg: 3 }}>
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          id={doc.id}
          name={doc.name}
          size={doc.size}
          type={doc.type}
          createdAt={doc.created_at}
          status={doc.status || 'pending'}
          progress={0}
          chunkCount={doc.chunk_count}
          needsOcr={doc.needs_ocr}
          error={doc.error_message}
          onProcess={onProcess}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onRetry={onRetry}
        />
      ))}
    </ResponsiveGrid>
  );
});

DocumentGrid.displayName = 'DocumentGrid';