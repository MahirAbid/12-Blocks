import { useState, useRef, useLayoutEffect } from 'react'
import ReactDOM from 'react-dom'
import './App.css'
import InfiniteStreakGrid from './InfiniteStreakGrid';

interface Habit {
  id: number
  name: string
}

// Portal component for menu popup
function MenuPortal({ anchorPos, open, onClose, children }: { anchorPos: { x: number, y: number } | null, open: boolean, onClose: () => void, children: React.ReactNode }) {
  const popupRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open || !anchorPos) return null;
  return ReactDOM.createPortal(
    <div
      ref={popupRef}
      className="menu-popup"
      style={{
        position: 'absolute',
        top: anchorPos.y,
        left: anchorPos.x,
        zIndex: 3000, // Increased z-index for overlay
        minWidth: 110,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

function App() {
  const [habits, setHabits] = useState<Habit[]>(() => {
    const saved = localStorage.getItem('habits');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addInput, setAddInput] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [menuAnchorPos, setMenuAnchorPos] = useState<{ x: number, y: number } | null>(null);
  const [view, setView] = useState<'list' | 'streak'>('list');
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [nameWarning, setNameWarning] = useState('');
  // Per-habit streaks
  const [habitStreaks, setHabitStreaks] = useState<Record<number, string[]>>(() => {
    const saved = localStorage.getItem('habitStreaks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });

  // Save per-habit streaks to localStorage
  useLayoutEffect(() => {
    localStorage.setItem('habitStreaks', JSON.stringify(habitStreaks));
  }, [habitStreaks]);

  // Save habits to localStorage on change
  useLayoutEffect(() => {
    localStorage.setItem('habits', JSON.stringify(habits));
  }, [habits]);

  const removeHabit = (id: number) => {
    setDeleteId(id)
  }

  const confirmRemoveHabit = () => {
    if (deleteId !== null) {
      setHabits(habits.filter(h => h.id !== deleteId))
      setDeleteId(null)
    }
  }

  const cancelRemoveHabit = () => {
    setDeleteId(null)
  }

  const startEdit = (id: number, name: string) => {
    setEditingId(id)
    setEditingName(name)
    setMenuOpenId(null)
    setMenuAnchorPos(null)
    setNameWarning('')
  }

  const saveEdit = (id: number) => {
    if (!editingName.trim()) return; // Prevent empty name
    if (editingName.trim().length > 20) {
      setNameWarning('Name cannot be more than 20 characters.');
      return;
    }
    setHabits(habits.map(h => h.id === id ? { ...h, name: editingName.trim() } : h))
    setEditingId(null)
    setEditingName('')
    setNameWarning('')
  }

  const handleDoubleClick = (id: number) => {
    const habit = habits.find(h => h.id === id);
    if (habit) {
      setSelectedHabit(habit);
      setView('streak');
    }
  }

  const handleAddHabit = () => {
    if (addInput.trim()) {
      const newId = Date.now();
      setHabits([...habits, { id: newId, name: addInput.trim() }]);
      setHabitStreaks(prev => ({ ...prev, [newId]: [] }));
      setAddInput('');
      setShowAddModal(false);
    }
  }

  // Drag and drop handlers
  const handleDragStart = (id: number, e?: React.DragEvent) => {
    setDraggedId(id);
    // Remove default drag image
    if (e) {
      const img = document.createElement('img');
      img.src =
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
      e.dataTransfer.setDragImage(img, 0, 0);
    }
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };
  const handleDragOver = (id: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragOverId !== id) setDragOverId(id);
  };
  const handleDrop = (id: number) => {
    if (draggedId === null || draggedId === id) return;
    const fromIdx = habits.findIndex(h => h.id === draggedId);
    const toIdx = habits.findIndex(h => h.id === id);
    if (fromIdx === -1 || toIdx === -1) return;
    const updated = [...habits];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setHabits(updated);
    setDraggedId(null);
    setDragOverId(null);
  };

  // Helper to get filledBlocks Set for selected habit
  const getFilledBlocksForSelected = () => {
    if (!selectedHabit) return new Set<string>();
    return new Set(habitStreaks[selectedHabit.id] || []);
  };

  return (
    <div className="main-container">
      {view === 'list' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h2 style={{ marginTop: 0, marginBottom: 8, textAlign: 'left' }}>12 Blocks</h2>
            <button
              className="add-habit-top-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: '1px solid #b0b4c0',
                color: '#23272f',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: 'none',
                marginRight: 0,
                marginTop: 0,
                marginBottom: 0,
                outline: 'none',
                transition: 'background 0.15s, border 0.15s',
              }}
              onClick={() => setShowAddModal(true)}
            >
              + Add Habit
            </button>
          </div>
          <div style={{ height: '32px' }} />
          <div className="habit-list">
            {habits.length === 0 ? (
              <div style={{ color: '#888', fontSize: 18, marginTop: 32 }}>No habits yet. Click "Add Habit" to get started!</div>
            ) : (
              habits.map((habit) => (
                <div
                  key={habit.id}
                  data-habit-id={habit.id}
                  className={`habit-box${draggedId === habit.id ? ' dragging' : ''}${dragOverId === habit.id && draggedId !== null && draggedId !== habit.id ? ' drag-over' : ''}`}
                  onDoubleClick={() => handleDoubleClick(habit.id)}
                  draggable
                  onDragStart={e => handleDragStart(habit.id, e)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => handleDragOver(habit.id, e)}
                  onDrop={() => handleDrop(habit.id)}
                  onContextMenu={e => {
                    e.preventDefault();
                    setMenuOpenId(habit.id);
                    setMenuAnchorPos({ x: e.clientX, y: e.clientY });
                  }}
                >
                  {editingId === habit.id ? (
                    <>
                      <input
                        value={editingName}
                        onChange={e => {
                          setEditingName(e.target.value)
                          if (e.target.value.trim().length > 20) {
                            setNameWarning('Name cannot be more than 20 characters.');
                          } else {
                            setNameWarning('');
                          }
                        }}
                        onBlur={() => {
                          if (editingName.trim() && editingName.trim().length <= 20) saveEdit(habit.id);
                          else if (!editingName.trim()) setEditingName(habits.find(h => h.id === habit.id)?.name || ''); // revert to old name
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (editingName.trim() && editingName.trim().length <= 20) saveEdit(habit.id);
                          }
                        }}
                        autoFocus
                        className="edit-input"
                        maxLength={20}
                      />
                      {nameWarning && <div style={{ color: '#b00020', fontSize: 13, marginTop: 4 }}>{nameWarning}</div>}
                      <MenuPortal
                        anchorPos={menuOpenId === habit.id ? menuAnchorPos : null}
                        open={menuOpenId === habit.id}
                        onClose={() => { setMenuOpenId(null); setMenuAnchorPos(null); }}
                      >
                        <button className="menu-item" onClick={() => startEdit(habit.id, habit.name)} disabled={editingId === habit.id}>Rename</button>
                        <button className="menu-item delete" onClick={() => removeHabit(habit.id)}>Delete</button>
                      </MenuPortal>
                    </>
                  ) : (
                    <>
                      <span
                        className="habit-name"
                        onDoubleClick={() => handleDoubleClick(habit.id)}
                        title="Double-click to view streak"
                      >
                        {habit.name}
                      </span>
                      <MenuPortal
                        anchorPos={menuOpenId === habit.id ? menuAnchorPos : null}
                        open={menuOpenId === habit.id}
                        onClose={() => { setMenuOpenId(null); setMenuAnchorPos(null); }}
                      >
                        <button
                          className="menu-item"
                          onClick={() => {
                            setMenuOpenId(null); setMenuAnchorPos(null); startEdit(habit.id, habit.name);
                          }}
                          disabled={editingId === habit.id}
                          onContextMenu={e => e.stopPropagation()}
                        >Rename</button>
                        <button
                          className="menu-item delete"
                          onClick={() => {
                            setMenuOpenId(null); setMenuAnchorPos(null); removeHabit(habit.id);
                          }}
                          onContextMenu={e => e.stopPropagation()}
                        >Delete</button>
                      </MenuPortal>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          {showAddModal && (
            <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Add a new habit</h3>
                <input
                  className="modal-input"
                  type="text"
                  value={addInput}
                  onChange={e => {
                    setAddInput(e.target.value)
                    if (e.target.value.trim().length > 20) {
                      setNameWarning('Name cannot be more than 20 characters.');
                    } else {
                      setNameWarning('');
                    }
                  }}
                  placeholder="Habit name"
                  autoFocus
                  maxLength={20}
                  onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
                />
                {nameWarning && <div style={{ color: '#b00020', fontSize: 13, marginTop: 4 }}>{nameWarning}</div>}
                <div className="modal-actions">
                  <button className="modal-cancel" onClick={() => { setShowAddModal(false); setNameWarning(''); }}>Cancel</button>
                  <button className="modal-add" onClick={handleAddHabit} disabled={!addInput.trim() || addInput.trim().length > 20}>Add</button>
                </div>
              </div>
            </div>
          )}
          {deleteId !== null && (
            <div className="modal-overlay" onClick={cancelRemoveHabit}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Delete Habit</h3>
                <div className="modal-warning">Are you sure you want to delete this habit?</div>
                <div className="modal-actions">
                  <button className="modal-cancel" onClick={cancelRemoveHabit}>Cancel</button>
                  <button className="modal-add" style={{background:'#b00020'}} onClick={confirmRemoveHabit}>Delete</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            width: '100%',
            height: '100%',
            minHeight: 0,
            minWidth: 0,
            flex: 1
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>{selectedHabit?.name || 'Habit'}</h2>
              <button
                className="streak-back-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: '1px solid #b0b4c0',
                  color: '#23272f',
                  borderRadius: 6,
                  padding: '6px 14px',
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: 'pointer',
                  boxShadow: 'none',
                  marginRight: 0,
                  marginTop: 0,
                  marginBottom: 0,
                  outline: 'none',
                  transition: 'background 0.15s, border 0.15s',
                }}
                onClick={() => setView('list')}
              >
                <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-block', marginRight: 2 }}>&larr;</span> Back
              </button>
            </div>
            <div style={{ height: '32px' }} />
            <div className="streak-main-container streak-box-container" style={{ flex: 1, minHeight: 0, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 0, overflow: 'hidden' }}>
              <InfiniteStreakGrid
                filledBlocks={getFilledBlocksForSelected()}
                setFilledBlocks={(setFn: (prev: Set<string>) => Set<string>) => {
                  if (!selectedHabit) return;
                  setHabitStreaks(prev => {
                    const prevArr = prev[selectedHabit.id] || [];
                    const prevSet = new Set(prevArr);
                    const nextSet = setFn(prevSet);
                    return { ...prev, [selectedHabit.id]: Array.from(nextSet) };
                  });
                }}
                resetScrollKey={selectedHabit?.id}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default App
