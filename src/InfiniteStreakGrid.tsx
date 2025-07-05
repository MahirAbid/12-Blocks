import { useRef, useLayoutEffect, useCallback, useState, useEffect } from 'react';
import { VariableSizeList as List } from 'react-window';
import './App.css';
import { useState as useReactState } from 'react';
import React from 'react';

const NUM_COLS = 24; // Number of blocks per day (no label col)
const BOX_SIZE = 40; // px
const GAP = 8; // px
const CTA_COLOR = '#3b5bfd';
const UNFILLED_COLOR = '#f0f2ff';
const BORDER_COLOR = '#e0e3eb';
const DATE_LABEL_HEIGHT = 28; // px
const BIG_ITEM_COUNT = 100_000;
const MID_ROW_INDEX = 50_000;

// Helper: get the date for a given row (row MID_ROW_INDEX = today, row MID_ROW_INDEX+1 = tomorrow, etc.)
function getDateForRow(rowIndex: number): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cellDate = new Date(now);
  cellDate.setDate(now.getDate() + (rowIndex - MID_ROW_INDEX));
  return cellDate;
}

interface InfiniteStreakGridProps {
  filledBlocks: Record<string, number>;
  setFilledBlocks: (fn: (prev: Record<string, number>) => Record<string, number>) => void;
  resetScrollKey?: string | number;
}

function InfiniteStreakGrid({ filledBlocks, setFilledBlocks, resetScrollKey }: InfiniteStreakGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [showScrollToToday, setShowScrollToToday] = useReactState(false);

  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);
  const [debugTime, setDebugTime] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16); // 'YYYY-MM-DDTHH:mm'
  });
  // Helper to get the current time (real or debug)
  function getNow() {
    return debugMode ? new Date(debugTime) : new Date();
  }

  // Responsive: track container width and height
  useLayoutEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
        setContainerHeight(containerRef.current.offsetHeight);
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calculate box size based on container width
  const totalGap = GAP * (NUM_COLS - 1);
  const boxSize = Math.floor((containerWidth - totalGap) / NUM_COLS) || BOX_SIZE;
  const rowWidth = NUM_COLS * boxSize + totalGap;
  const rowHeight = boxSize + DATE_LABEL_HEIGHT + GAP;

  // Render a row: date label above, then row of blocks
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const now = getNow();
    const cellDate = getDateForRow(index);
    const dateStr = cellDate.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric', year: 'numeric' });
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const isToday = cellDate.getTime() === today.getTime();
    const currentHour = now.getHours();
    // Timer state for the current hour block
    const [timeLeft, setTimeLeft] = useReactState(() => {
      if (!isToday) return null;
      const msToNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
      return msToNextHour;
    });
    // Update timer every second for the current hour block only
    useEffect(() => {
      if (!isToday) return;
      if (debugMode) return; // Don't auto-update timer in debug mode
      const interval = setInterval(() => {
        const now = getNow();
        const msToNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
        setTimeLeft(msToNextHour);
      }, 1000);
      return () => clearInterval(interval);
    }, [isToday, setTimeLeft, debugMode, debugTime]);
    useEffect(() => {
      if (!isToday) return;
      if (!debugMode) return;
      // In debug mode, update timer when debugTime changes
      const now = getNow();
      const msToNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
      setTimeLeft(msToNextHour);
    }, [isToday, debugMode, debugTime]);
    function formatTime(ms: number | null) {
      if (ms == null) return '';
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const min = Math.floor(totalSeconds / 60);
      const sec = totalSeconds % 60;
      return `${min}:${sec.toString().padStart(2, '0')}`;
    }
    return (
      <div style={{ ...style, width: rowWidth, display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'transparent' }}>
        <div style={{
          height: DATE_LABEL_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          fontWeight: 600,
          fontSize: 13,
          color: '#b0b4c0',
          marginBottom: 2,
          userSelect: 'none',
          width: '100%',
          paddingLeft: 4,
        }}>{dateStr}</div>
        <div style={{ display: 'flex', gap: GAP }}>
          {Array.from({ length: NUM_COLS }).map((_, colIdx) => {
            const blockKey = `${index}-${colIdx}`;
            // Only allow toggling if this is today and colIdx matches current hour
            const isUnlocked = isToday && colIdx === currentHour;
            const isChecked = filledBlocks[blockKey] !== undefined;
            return (
              <div
                key={blockKey}
                style={{
                  width: boxSize,
                  height: boxSize,
                  background: isChecked
                    ? `hsl(226, ${getSaturationLevel(filledBlocks[blockKey], cellDate, colIdx)}%, 60%)`
                    : (isUnlocked ? UNFILLED_COLOR : '#f3f4f8'),
                  border: `1px solid ${BORDER_COLOR}`,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  opacity: isChecked ? 1 : (isUnlocked ? 1 : 0.5),
                  transition: 'background 0.15s',
                  boxSizing: 'border-box',
                  backfaceVisibility: 'hidden',
                  transform: 'translateZ(0)',
                  position: 'relative',
                }}
                onClick={() => {
                  if (!isUnlocked) return;
                  setFilledBlocks(prev => {
                    const next = { ...prev };
                    if (next[blockKey]) {
                      delete next[blockKey];
                    } else {
                      next[blockKey] = getNow().getTime();
                    }
                    return next;
                  });
                }}
              >
                {/* Show timer on the current hour's block for today */}
                {isUnlocked && (
                  <span style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    fontSize: 15,
                    color: isChecked ? '#fff' : '#3b5bfd',
                    fontWeight: 700,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}>{formatTime(timeLeft)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [filledBlocks, boxSize, rowWidth, debugMode, debugTime]);

  const listRef = useRef<any>(null);

  // Scroll to today (MID_ROW_INDEX) when resetScrollKey changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(MID_ROW_INDEX, 'start');
    }
  }, [resetScrollKey, containerHeight, containerWidth]);

  // Handler for visible rows
  const handleItemsRendered = useCallback((props: { visibleStartIndex: number; visibleStopIndex: number }) => {
    if (props.visibleStartIndex <= MID_ROW_INDEX && props.visibleStopIndex >= MID_ROW_INDEX) {
      setShowScrollToToday(false);
    } else {
      setShowScrollToToday(true);
    }
  }, []);

  // Remove always-visible debug UI, and add keyboard shortcut to toggle debugMode
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        setDebugMode(dm => !dm);
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
    >
      {/* Debug UI only visible in debugMode */}
      {debugMode && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 20, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>
            Debug/Time Traveler
          </label>
          <input
            type="datetime-local"
            value={debugTime}
            onChange={e => setDebugTime(e.target.value)}
            style={{ fontSize: 13, padding: '2px 6px', borderRadius: 4, border: '1px solid #ccc' }}
          />
        </div>
      )}
      {containerWidth > 0 && containerHeight > 0 && (
        <>
          <List
            ref={listRef}
            className="no-scrollbar"
            height={containerHeight}
            width={containerWidth}
            itemCount={BIG_ITEM_COUNT}
            itemSize={() => rowHeight}
            overscanCount={10}
            initialScrollOffset={rowHeight * MID_ROW_INDEX}
            onItemsRendered={({ visibleStartIndex, visibleStopIndex }) => handleItemsRendered({ visibleStartIndex, visibleStopIndex })}
          >
            {Row}
          </List>
          {showScrollToToday && (
            <button
              aria-label="Scroll to Today"
              style={{
                position: 'absolute',
                bottom: 40,
                right: 40,
                zIndex: 10,
                width: 96,
                height: 96,
                background: CTA_COLOR,
                border: 'none',
                borderRadius: '50%',
                boxShadow: '0 4px 16px 0 rgba(35,39,47,0.10), 0 1.5px 6px 0 rgba(35,39,47,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
                outline: 'none',
                padding: 0,
                minWidth: 0,
                minHeight: 0,
              }}
              onClick={() => {
                if (listRef.current) {
                  listRef.current.scrollToItem(MID_ROW_INDEX, 'center');
                }
              }}
            >
              <span style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: 0.5,
                textAlign: 'center',
                userSelect: 'none',
                pointerEvents: 'none',
                lineHeight: 1.1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}>
                Jump<br />Today
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Color calculation for checked blocks
function getSaturationLevel(checkedAt: number | undefined, cellDate: Date, colIdx: number) {
  if (!checkedAt) return 0;
  // cellDate is midnight of the day, colIdx is the hour
  const blockStart = new Date(cellDate);
  blockStart.setHours(colIdx, 0, 0, 0);
  const diffMs = checkedAt - blockStart.getTime();
  if (diffMs < 0 || diffMs > 60 * 60 * 1000) return 0; // checked outside the hour
  const diffMin = diffMs / 60000;
  if (diffMin <= 10) return 100;
  if (diffMin <= 20) return 80;
  if (diffMin <= 30) return 60;
  if (diffMin <= 40) return 40;
  if (diffMin <= 50) return 20;
  return 5;
}

export default InfiniteStreakGrid;
