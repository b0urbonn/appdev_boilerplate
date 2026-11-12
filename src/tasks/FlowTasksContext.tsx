import Storage from 'expo-sqlite/kv-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Priority = 'Low' | 'Medium' | 'High';
export type Mood = 'Great' | 'Good' | 'Okay' | 'Low' | 'Stressed';

export type FlowTask = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  category: string;
  priority: Priority;
  completed: boolean;
  mood?: Mood;
  notes?: string;
};

type NewTask = Pick<FlowTask, 'title' | 'date' | 'time' | 'category' | 'priority'> & Pick<FlowTask, 'mood' | 'notes'>;

type FlowTasksValue = {
  tasks: FlowTask[];
  addTask: (task: NewTask) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  resetSampleTasks: () => void;
};

const STORAGE_KEY = 'flowtask.tasks';
const FlowTasksContext = createContext<FlowTasksValue | null>(null);

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function formatTaskDate(key: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-US', options);
}

function createSampleTasks(): FlowTask[] {
  const today = new Date();
  return [
    { id: 'sample-1', title: 'Review project proposal', date: dateKey(today), time: '09:00', duration: 45, category: 'Work', priority: 'High', completed: true },
    { id: 'sample-2', title: 'Morning journaling', date: dateKey(today), time: '10:00', duration: 15, category: 'Personal', priority: 'Low', completed: false },
    { id: 'sample-3', title: 'Team design sync', date: dateKey(today), time: '11:30', duration: 60, category: 'Work', priority: 'Medium', completed: false },
    { id: 'sample-4', title: 'Pick up groceries', date: dateKey(today), time: '14:00', duration: 30, category: 'Errands', priority: 'Low', completed: false },
    { id: 'sample-5', title: 'Plan next week', date: dateKey(addDays(today, 1)), time: '16:00', duration: 30, category: 'Personal', priority: 'Medium', completed: false },
  ];
}

function isPriority(value: unknown): value is Priority {
  return value === 'Low' || value === 'Medium' || value === 'High';
}

function isMood(value: unknown): value is Mood {
  return value === 'Great' || value === 'Good' || value === 'Okay' || value === 'Low' || value === 'Stressed';
}

function normalizeFlowTask(value: unknown): FlowTask | null {
  if (!value || typeof value !== 'object') return null;
  const task = value as Record<string, unknown>;
  const priority = isPriority(task.priority) ? task.priority : isPriority(task.energy) ? task.energy : null;
  if (typeof task.id !== 'string'
    || typeof task.title !== 'string'
    || typeof task.date !== 'string'
    || typeof task.time !== 'string'
    || typeof task.duration !== 'number'
    || typeof task.category !== 'string'
    || !priority
    || typeof task.completed !== 'boolean'
    || (task.mood !== undefined && !isMood(task.mood))
    || (task.notes !== undefined && typeof task.notes !== 'string')) return null;

  return {
    id: task.id,
    title: task.title,
    date: task.date,
    time: task.time,
    duration: task.duration,
    category: task.category,
    priority,
    completed: task.completed,
    ...(isMood(task.mood) ? { mood: task.mood } : {}),
    ...(typeof task.notes === 'string' ? { notes: task.notes } : {}),
  };
}

export function FlowTasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<FlowTask[]>(createSampleTasks);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Storage.getItem(STORAGE_KEY)
      .then(value => {
        if (value) {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed)) {
            const restored = parsed.map(normalizeFlowTask);
            if (restored.every(task => task !== null)) setTasks(restored.filter((task): task is FlowTask => task !== null));
            else console.warn('Saved task data is invalid; keeping sample tasks.');
          }
          else console.warn('Saved task data is invalid; keeping sample tasks.');
        }
      })
      .catch(error => console.warn('Unable to load tasks:', error))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    Storage.setItemAsync(STORAGE_KEY, JSON.stringify(tasks))
      .catch(error => console.warn('Unable to save tasks:', error));
  }, [loaded, tasks]);

  const addTask = useCallback(({ title, date, time, category, priority, mood, notes }: NewTask) => {
    setTasks(current => [...current, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      date,
      time,
      duration: 30,
      category,
      priority,
      completed: false,
      mood,
      notes: notes?.trim() ?? '',
    }]);
  }, []);
  const toggleTask = useCallback((id: string) => {
    setTasks(current => current.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
  }, []);
  const deleteTask = useCallback((id: string) => {
    setTasks(current => current.filter(task => task.id !== id));
  }, []);
  const resetSampleTasks = useCallback(() => setTasks(createSampleTasks()), []);
  const value = useMemo(() => ({ tasks, addTask, toggleTask, deleteTask, resetSampleTasks }), [tasks, addTask, toggleTask, deleteTask, resetSampleTasks]);

  return <FlowTasksContext.Provider value={value}>{children}</FlowTasksContext.Provider>;
}

export function useFlowTasks() {
  const value = useContext(FlowTasksContext);
  if (!value) throw new Error('useFlowTasks must be used within FlowTasksProvider');
  return value;
}
