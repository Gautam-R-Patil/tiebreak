import { useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';

function RankCard({ id, index, label, total, onUp, onDown, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={`rank-card ${isDragging ? 'rank-card--dragging' : ''}`}>
      <button className="rank-card__handle" {...attributes} {...listeners} aria-label={`Drag to reorder ${label}`} type="button">
        ⋮⋮
      </button>
      <span className={`rank-card__num ${index === 0 ? 'rank-card__num--1' : ''}`}>{index + 1}</span>
      <span className="rank-card__label">{label}</span>
      <span className="rank-card__actions">
        <button className="rank-card__btn" onClick={onUp} disabled={index === 0} aria-label="Move up" type="button">
          ↑
        </button>
        <button className="rank-card__btn" onClick={onDown} disabled={index === total - 1} aria-label="Move down" type="button">
          ↓
        </button>
        <button className="rank-card__btn" onClick={onRemove} aria-label="Remove from ranking" type="button">
          ✕
        </button>
      </span>
    </div>
  );
}

/**
 * Ballot builder. `options` is the full option list; `value` is the ordered
 * array of option ids the voter has ranked. Unranked options live in a pool
 * below and can be tapped to append them.
 */
export default function RankBallot({ options, value, onChange, disabled }) {
  const [ranked, setRanked] = useState(value || []);
  useEffect(() => setRanked(value || []), [value]);

  const byId = useMemo(() => Object.fromEntries(options.map((o) => [o.id, o])), [options]);
  const pool = options.filter((o) => !ranked.includes(o.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commit(next) {
    setRanked(next);
    onChange?.(next);
  }

  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = ranked.indexOf(active.id);
    const to = ranked.indexOf(over.id);
    commit(arrayMove(ranked, from, to));
  }

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= ranked.length) return;
    commit(arrayMove(ranked, i, j));
  };

  return (
    <div className="ballot" aria-disabled={disabled}>
      <div>
        <div className="row row--between" style={{ marginBottom: 10 }}>
          <strong>Your ranking</strong>
          <span className="small muted">Drag, or use the arrows. #1 is your favourite.</span>
        </div>
        {ranked.length === 0 ? (
          <div className="ballot__drop">Tap options below to start ranking them.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ranked} strategy={verticalListSortingStrategy}>
              <div className="ballot__ranked">
                {ranked.map((id, i) =>
                  byId[id] ? (
                    <RankCard
                      key={id}
                      id={id}
                      index={i}
                      total={ranked.length}
                      label={byId[id].label}
                      onUp={() => move(i, -1)}
                      onDown={() => move(i, 1)}
                      onRemove={() => commit(ranked.filter((x) => x !== id))}
                    />
                  ) : null,
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div>
        <div className="row row--between" style={{ marginBottom: 10 }}>
          <strong>Not ranked{pool.length ? ` (${pool.length})` : ''}</strong>
          {pool.length > 0 && (
            <button className="btn btn--subtle btn--sm" type="button" onClick={() => commit([...ranked, ...pool.map((o) => o.id)])}>
              Add all
            </button>
          )}
        </div>
        {pool.length === 0 ? (
          <p className="small muted">Every option is ranked. You can leave some out if you'd never pick them.</p>
        ) : (
          <div className="ballot__pool">
            <AnimatePresence initial={false}>
              {pool.map((o) => (
                <motion.button
                  key={o.id}
                  type="button"
                  className="pool-chip"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => commit([...ranked, o.id])}
                >
                  + {o.label}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
