import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fmtInt } from '../lib/format';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, totalPages, totalElements, pageSize, onPage }: PaginationProps) {
  if (totalElements === 0) return null;
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalElements);
  return (
    <div className="pagination">
      <span className="pagination-meta">
        <strong>{fmtInt(start)}–{fmtInt(end)}</strong> of {fmtInt(totalElements)}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onPage(page - 1)}
          disabled={page <= 0}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="pagination-page">
          Page {page + 1} / {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onPage(page + 1)}
          disabled={page + 1 >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
