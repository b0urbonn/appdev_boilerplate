import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter, type Href } from 'expo-router';
import React, { useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { useTheme } from '@/theme';

const SIZE = 56;
const EDGE = 12;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Browser pointer events keep clicks and dragging independent of native gesture worklets. */
export function FloatingChatButton() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const maxX = Math.max(EDGE, width - SIZE - EDGE);
  const maxY = Math.max(EDGE, height - SIZE - 112);
  const [position, setPosition] = useState(() => ({ x: maxX, y: clamp(height / 2 - SIZE / 2, EDGE, maxY) }));
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointer: number; x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const currentPosition = {
    x: clamp(position.x, EDGE, maxX),
    y: clamp(position.y, EDGE, maxY),
  };

  if (pathname.endsWith('/chat')) return null;
  return (
    <button
      type="button"
      aria-label="Open chatbot"
      title="Drag to move, or tap to open Chat"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, originX: currentPosition.x, originY: currentPosition.y, moved: false };
        dragged.current = false;
      }}
      onPointerMove={event => {
        const active = drag.current;
        if (!active || active.pointer !== event.pointerId) return;
        const dx = event.clientX - active.x;
        const dy = event.clientY - active.y;
        if (Math.abs(dx) + Math.abs(dy) > 8) { active.moved = true; setDragging(true); }
        if (active.moved) setPosition({ x: clamp(active.originX + dx, EDGE, maxX), y: clamp(active.originY + dy, EDGE, maxY) });
      }}
      onPointerUp={event => {
        const active = drag.current;
        if (!active || active.pointer !== event.pointerId) return;
        dragged.current = active.moved;
        drag.current = null;
        setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; dragged.current = true; setDragging(false); }}
      onClick={event => { if (event.detail === 0 || !dragged.current) router.push('/(tabs)/chat' as Href); }}
      style={{
        position: 'fixed', left: currentPosition.x, top: currentPosition.y, zIndex: 200,
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        border: `2px solid ${theme.background}`, background: theme.buttonPrimary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px #0003', color: 'white', padding: 0,
        touchAction: 'none', cursor: dragging ? 'grabbing' : 'pointer',
        transform: dragging ? 'scale(1.06)' : 'scale(1)',
        transition: reduceMotion ? 'none' : 'transform 120ms ease',
      }}
    ><Ionicons name="chatbubble-ellipses" size={26} color="#FFFFFF" /></button>
  );
}
