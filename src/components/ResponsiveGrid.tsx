import { cn } from "@/lib/utils";
import { memo, ReactNode } from "react";

interface ResponsiveGridProps {
  children: ReactNode | ReactNode[];
  className?: string;
  cols?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export const ResponsiveGrid = memo(({ 
  children, 
  className, 
  cols = { sm: 1, md: 2, lg: 3, xl: 4 }
}: ResponsiveGridProps) => {
  // Map numbers to actual Tailwind classes
  const getGridCols = (breakpoint: 'sm' | 'md' | 'lg' | 'xl', value?: number) => {
    if (!value) return '';
    
    const colMap: Record<string, string> = {
      'sm-1': 'grid-cols-1',
      'sm-2': 'grid-cols-2',
      'sm-3': 'grid-cols-3',
      'sm-4': 'grid-cols-4',
      'md-1': 'md:grid-cols-1',
      'md-2': 'md:grid-cols-2',
      'md-3': 'md:grid-cols-3',
      'md-4': 'md:grid-cols-4',
      'lg-1': 'lg:grid-cols-1',
      'lg-2': 'lg:grid-cols-2',
      'lg-3': 'lg:grid-cols-3',
      'lg-4': 'lg:grid-cols-4',
      'xl-1': 'xl:grid-cols-1',
      'xl-2': 'xl:grid-cols-2',
      'xl-3': 'xl:grid-cols-3',
      'xl-4': 'xl:grid-cols-4',
    };
    
    return colMap[`${breakpoint}-${value}`] || '';
  };

  const gridClasses = cn(
    "grid gap-4 md:gap-4 lg:gap-6",
    getGridCols('sm', cols.sm),
    getGridCols('md', cols.md),
    getGridCols('lg', cols.lg),
    getGridCols('xl', cols.xl),
    className
  );

  return (
    <div className={gridClasses} role="list">
      {children}
    </div>
  );
});

ResponsiveGrid.displayName = 'ResponsiveGrid';