import { DocumentCard } from "@/components/DocumentCard";
import { Document } from "@/pages/Documents";
import { Grid } from "react-window";

interface VirtualizedDocumentGridProps {
  documents: Document[];
  onProcess: (id: string) => void;
  onDelete: (documentId: string, documentName: string, storagePath: string) => void;
  onDownload: (storagePath: string, fileName: string) => void;
  onRetry: (id: string) => void;
  processingDocId: string | null;
}

interface CellData extends VirtualizedDocumentGridProps {
  handleDelete: (id: string) => void;
  handleDownload: (id: string) => void;
  columnCount: number;
}

export const VirtualizedDocumentGrid = ({ 
  documents, 
  onProcess, 
  onDelete, 
  onDownload, 
  onRetry,
  processingDocId
}: VirtualizedDocumentGridProps) => {
  const calculateColumnCount = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1024) return 3;
      if (window.innerWidth >= 768) return 2;
      return 1;
    }
    return 3;
  };

  const columnCount = calculateColumnCount();
  const itemWidth = 384;
  const itemHeight = 384;
  const rowCount = Math.ceil(documents.length / columnCount);

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

  const Cell = ({ 
    columnIndex, 
    rowIndex, 
    style,
    data
  }: { 
    columnIndex: number; 
    rowIndex: number; 
    style: React.CSSProperties;
    data: VirtualizedDocumentGridProps & { handleDelete: (id: string) => void; handleDownload: (id: string) => void; columnCount: number; };
  }) => {
    const { documents, onProcess, handleDelete, handleDownload, onRetry } = data;
    const index = rowIndex * data.columnCount + columnIndex;
    
    if (index >= documents.length) {
      return <div style={style} />;
    }

    const doc = documents[index];
    
    return (
      <div style={style} className="p-3">
        <DocumentCard
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
      </div>
    );
  };

  return (
    <div className="mx-auto" style={{ width: '100%' }}>
      <Grid
        columnCount={columnCount}
        columnWidth={itemWidth}
        height={itemHeight * Math.min(rowCount, 5)}
        rowCount={rowCount}
        rowHeight={itemHeight}
        width={columnCount * itemWidth}
        itemData={{ documents, onProcess, onDelete, onDownload, onRetry, processingDocId, handleDelete, handleDownload, columnCount }}
      >
        {Cell}
      </Grid>
    </div>
  );
};