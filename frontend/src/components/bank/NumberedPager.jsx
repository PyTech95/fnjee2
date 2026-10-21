import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageWindow } from "@/lib/bank";

/**
 * « Prev  1 … 4 [5] 6 … 16  Next »  ·  Showing 201–250 of 800  ·  [50 / page]
 * compact: smaller buttons, fewer page numbers (for side panels).
 */
export default function NumberedPager({
  page, pages, total, pageSize, onPage, onPageSize, loading = false,
  sizes = [20, 30, 50, 100], compact = false, testId = "bank-pager", noun = "questions",
}) {
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  const go = (p) => onPage(Math.min(Math.max(1, p), pages));
  const btn = compact ? "h-7 min-w-7 px-2 text-xs" : "h-8 min-w-8 px-2.5";
  const nums = pageWindow(page, pages, compact ? 1 : 2);

  return (
    <div data-testid={testId} className={`flex flex-wrap items-center justify-between gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      <div className="text-muted-foreground">
        Showing <b className="text-foreground">{from.toLocaleString()}–{to.toLocaleString()}</b> of{" "}
        <b className="text-foreground">{total.toLocaleString()}</b> {noun}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" variant="outline" className={`${btn} rounded-full`} data-testid={`${testId}-prev`}
          disabled={page <= 1 || loading} onClick={() => go(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />{!compact && <span className="ml-0.5">Prev</span>}
        </Button>
        {nums.map((n) => typeof n === "number" ? (
          <Button key={n} type="button" size="sm" variant={n === page ? "default" : "outline"}
            className={`${btn} rounded-full tabular-nums`} data-testid={`${testId}-page-${n}`}
            aria-current={n === page ? "page" : undefined} disabled={loading && n !== page}
            onClick={() => n !== page && go(n)}>
            {n}
          </Button>
        ) : (
          <span key={n} className="px-1 text-muted-foreground select-none">…</span>
        ))}
        <Button type="button" size="sm" variant="outline" className={`${btn} rounded-full`} data-testid={`${testId}-next`}
          disabled={page >= pages || loading} onClick={() => go(page + 1)} aria-label="Next page">
          {!compact && <span className="mr-0.5">Next</span>}<ChevronRight className="h-4 w-4" />
        </Button>
        {onPageSize && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
            <SelectTrigger data-testid={`${testId}-size`} className={`${compact ? "h-7 w-[86px] text-xs" : "h-8 w-[104px]"} ml-1`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((n) => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
