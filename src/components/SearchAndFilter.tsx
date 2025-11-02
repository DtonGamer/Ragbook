import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

interface SearchAndFilterProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter?: string;
  onStatusChange?: (value: string) => void;
  typeFilter?: string;
  onTypeChange?: (value: string) => void;
  className?: string;
  showFilters?: boolean;
  onFiltersToggle?: () => void;
}

export const SearchAndFilter = ({ 
  searchQuery, 
  onSearchChange, 
  statusFilter, 
  onStatusChange,
  typeFilter,
  onTypeChange,
  className,
  showFilters = true,
  onFiltersToggle
}: SearchAndFilterProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <div className="relative flex-1">
          <Search 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" 
            aria-hidden="true"
          />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
            aria-label="Search documents"
          />
        </div>
        {onFiltersToggle && (
          <Button
            variant="outline"
            onClick={onFiltersToggle}
            className="sm:flex-none"
            aria-label="Toggle filters"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" aria-hidden="true" />
            Filters
          </Button>
        )}
      </div>

      {showFilters && (
        <div 
          className={cn(
            "grid grid-cols-1 md:grid-cols-2 gap-2 transition-all duration-300",
            isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0 overflow-hidden"
          )}
          role="region"
          aria-label="Document filters"
        >
          {onStatusChange && (
            <div role="group" aria-label="Status filter">
              <Select value={statusFilter} onValueChange={onStatusChange}>
                <SelectTrigger aria-label="Filter by status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {onTypeChange && (
            <div role="group" aria-label="Type filter">
              <Select value={typeFilter} onValueChange={onTypeChange}>
                <SelectTrigger aria-label="Filter by document type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="doc">DOC</SelectItem>
                  <SelectItem value="txt">TXT</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};