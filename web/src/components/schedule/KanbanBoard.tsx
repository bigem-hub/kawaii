import { useState, useCallback } from "react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MoreHorizontal } from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import {
  type ScheduleItem,
  type ScheduleStatus,
  SCHEDULE_STATUSES,
} from "@/lib/schedule";

interface Props {
  items: ScheduleItem[];
  onOpen: (item: ScheduleItem | null, status?: ScheduleStatus) => void;
  onMove: (item: ScheduleItem, status: ScheduleStatus, targetIds: string[]) => void;
  onReorder: (columnStatus: ScheduleStatus, ids: string[]) => void;
}

function Column({
  status,
  children,
}: {
  status: ScheduleStatus;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded-2xl p-2 sm:p-3 min-h-[240px] transition-colors ${
        isOver ? "bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]/40" : "bg-[var(--surface-2)]/60"
      }`}
    >
      {children}
    </div>
  );
}

export function KanbanBoard({ items, onOpen, onMove, onReorder }: Props) {
  const [activeItem, setActiveItem] = useState<ScheduleItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setActiveItem(items.find((i) => i.id === active.id) ?? null);
    },
    [items]
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveItem(null);
      if (!over) return;
      const dragged = items.find((i) => i.id === active.id);
      if (!dragged) return;

      const overId = String(over.id);
      const overStatus =
        overId === "todo" || overId === "in_progress" || overId === "done"
          ? (overId as ScheduleStatus)
          : null;

      if (overStatus) {
        // Dropped onto a column background
        onMove(dragged, overStatus, [dragged.id]);
        return;
      }

      const overItem = items.find((i) => i.id === overId);
      if (!overItem) return;

      const sourceStatus = dragged.status;
      const newStatus = overItem.status;
      const inSameColumn = sourceStatus === newStatus;

      const targetColumn = items.filter((i) => i.status === newStatus);
      const newTargetOrder: string[] = targetColumn.map((i) => i.id);
      const fromIndex = newTargetOrder.indexOf(dragged.id);
      const toIndex = newTargetOrder.indexOf(overItem.id);

      if (inSameColumn) {
        // Reorder within the same column
        if (fromIndex > -1) newTargetOrder.splice(fromIndex, 1);
        newTargetOrder.splice(toIndex, 0, dragged.id);
        onReorder(newStatus, newTargetOrder);
      } else {
        // Move across columns — insert dragged id at the over-item position
        newTargetOrder.splice(toIndex, 0, dragged.id);
        onMove(dragged, newStatus, newTargetOrder);
      }
    },
    [items, onMove, onReorder]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SCHEDULE_STATUSES.map((col) => {
          const columnItems = items
            .filter((i) => i.status === col.value)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <Column key={col.value} status={col.value}>
              <div className="flex items-center justify-between mb-1 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                  <span className="text-sm font-bold">{col.label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{columnItems.length}</span>
                </div>
                <button
                  className="p-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
                  onClick={() => onOpen(null, col.value)}
                  aria-label={`Add to ${col.label}`}
                >
                  +
                </button>
              </div>
              <SortableContext items={columnItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 min-h-[60px]">
                  {columnItems.length === 0 && (
                    <div className="text-center text-xs text-[var(--text-muted)] py-6 border border-dashed border-[var(--border)] rounded-xl">
                      Drop items here
                    </div>
                  )}
                  {columnItems.map((item) => (
                    <KanbanCard key={item.id} item={item} onClick={() => onOpen(item)} />
                  ))}
                </div>
              </SortableContext>
            </Column>
          );
        })}
      </div>
      {activeItem && (
        <div className="mt-3 text-xs text-[var(--text-muted)] flex items-center gap-2">
          <MoreHorizontal size={14} /> Moving “{activeItem.title}” — drag to another column
        </div>
      )}
    </DndContext>
  );
}