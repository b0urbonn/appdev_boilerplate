import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import tapSoundUrl from '../assets/sounds/tap.wav?url';
import { localize, localeFor, type AppLanguage } from './i18n';
import { getTaskAssistantReply } from './tasks/taskAssistant';

type Tab = 'Tasks' | 'Calendar' | 'Progress' | 'Assistant' | 'Settings';
type Theme = 'dark' | 'light';
type Priority = 'Low' | 'Medium' | 'High';
type Mood = 'Great' | 'Good' | 'Okay' | 'Low' | 'Stressed';
type CalendarView = 'Year' | 'Month' | 'Week' | 'Day' | 'Schedule';
type Task = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  category: string;
  priority?: Priority;
  energy?: Priority;
  completed: boolean;
  mood?: Mood;
  notes?: string;
};
type ChatMessage = { id: string; from: 'assistant' | 'user'; text: string };
type IconName =
  | 'bolt' | 'sun' | 'moon' | 'target' | 'chevron-left' | 'chevron-right'
  | 'plus' | 'check' | 'search' | 'close' | 'trash' | 'calendar' | 'clock'
  | 'sparkles' | 'send' | 'settings' | 'tasks' | 'week' | 'chat' | 'user'
  | 'arrow-right' | 'arrow-up' | 'arrow-down' | 'check-circle' | 'menu' | 'leaf' | 'bell' | 'volume'
  | 'chart' | 'edit' | 'circle';
const moodOptions: { label: Mood; icon: IconName; color: string }[] = [
  { label: 'Great', icon: 'sun', color: '#D6A31E' },
  { label: 'Good', icon: 'leaf', color: '#32A879' },
  { label: 'Okay', icon: 'circle', color: '#5585D6' },
  { label: 'Low', icon: 'moon', color: '#7D74C9' },
  { label: 'Stressed', icon: 'bolt', color: '#D46B59' },
];
const taskCategories = [
  { label: 'Work', icon: 'target' as const, color: '#4C83D8' },
  { label: 'Personal', icon: 'user' as const, color: '#8A68C7' },
  { label: 'Errands', icon: 'calendar' as const, color: '#D88A36' },
];
const taskPriorities: { label: Priority; icon: IconName; color: string }[] = [
  { label: 'Low', icon: 'arrow-down', color: '#3D9C69' },
  { label: 'Medium', icon: 'circle', color: '#D89928' },
  { label: 'High', icon: 'arrow-up', color: '#D45D53' },
];

const today = dateKey(new Date());
const sampleTasks: Task[] = [
  { id: 't1', title: 'Review project proposal', date: today, time: '09:00', duration: 45, category: 'Work', priority: 'High', completed: true },
  { id: 't2', title: 'Morning journaling', date: today, time: '10:00', duration: 15, category: 'Personal', priority: 'Low', completed: false },
  { id: 't3', title: 'Team design sync', date: today, time: '11:30', duration: 60, category: 'Work', priority: 'Medium', completed: false },
  { id: 't4', title: 'Pick up groceries', date: today, time: '14:00', duration: 30, category: 'Errands', priority: 'Low', completed: false },
  { id: 't5', title: 'Plan next week', date: dateKey(addDays(new Date(), 1)), time: '16:00', duration: 30, category: 'Personal', priority: 'Medium', completed: false },
];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}
function prettyDate(key: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }, language: AppLanguage = 'en') {
  return new Date(`${key}T12:00:00`).toLocaleDateString(localeFor(language), options);
}
function getTaskPriority(task: Task): Priority {
  return task.priority ?? task.energy ?? 'Medium';
}
function useStoredState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) as T : initialValue;
    } catch (error) {
      console.warn(`Could not restore ${key}`, error);
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Could not save ${key}`, error);
    }
  }, [key, value]);
  return [value, setValue] as const;
}

function Icon({ name, size = 18, className = '', color }: { name: IconName; size?: number; className?: string; color?: string }) {
  const shapes: Record<IconName, ReactNode> = {
    bolt: <><path d="m13 2-3 8h7l-6 12 1-9H5l8-11Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    'chevron-left': <path d="m15 18-6-6 6-6" />,
    'chevron-right': <path d="m9 18 6-6-6-6" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    trash: <><path d="M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    sparkles: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z" /><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 3l.7 2.3L8 6l-2.3.7L5 9l-.7-2.3L2 6l2.3-.7L5 3Z" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z" transform="translate(-1 -1) scale(1.08)" /></>,
    tasks: <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M9 4.5h6M8 10h8M8 14h8M8 18h5" /></>,
    week: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M7 2v4m10-4v4M3 9h18M7 13h2m4 0h2m-8 4h2" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-3.5-.8L4 20l1.2-3.4A7.2 7.2 0 0 1 4 12c0-4.1 3.6-7 8-7s8 2.4 8 6.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    'arrow-right': <><path d="M5 12h14m-7-7 7 7-7 7" /></>,
    'arrow-up': <><path d="M12 19V5m-7 7 7-7 7 7" /></>,
    'arrow-down': <><path d="M12 5v14m-7-7 7 7 7-7" /></>,
    'check-circle': <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    leaf: <><path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-6 10-16Z" /><path d="M5 19c3-4 6-6 11-9" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" /></>,
    volume: <><path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" /></>,
    chart: <><path d="M4 19V5m0 14h17M8 15l4-4 3 2 5-6" /></>,
    edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></>,
    circle: <circle cx="12" cy="12" r="9" />,
  };
  return <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={color ? { color } : undefined}>{shapes[name]}</svg>;
}

const navItems: { label: Tab; icon: IconName }[] = [
  { label: 'Tasks', icon: 'tasks' },
  { label: 'Calendar', icon: 'calendar' },
  { label: 'Progress', icon: 'chart' },
  { label: 'Settings', icon: 'settings' },
];
const onboardingSlides = [
  { eyebrow: 'YOUR CALMER WORKDAY', title: 'Welcome to FlowTask.', body: 'A little more focus. A lot less overwhelm. Let’s make room for what matters.', icon: 'bolt' as const },
  { eyebrow: 'A CLEARER PICTURE', title: 'See your week at a glance.', body: 'Bring your tasks, plans, and priorities together in one thoughtfully simple space.', icon: 'calendar' as const },
  { eyebrow: 'A LITTLE EXTRA CLARITY', title: 'Meet your AI planner.', body: 'Turn a busy list into a balanced plan, with a helpful nudge whenever you need one.', icon: 'sparkles' as const },
];
const tutorialSteps: { tab: Exclude<Tab, 'Assistant'>; title: string; description: string }[] = [
  { tab: 'Tasks', title: 'Your tasks and buttons', description: 'Date buttons choose a day. Add task opens the form for its name, date, time, category, priority, mood, and notes. Search, View all, status, and priority buttons help find tasks. Tap a task circle to complete it or the trash button to delete it.' },
  { tab: 'Calendar', title: 'Your calendar buttons', description: 'The menu chooses Year, Month, Week, Day, or Schedule. Search finds a task; Today returns to today; arrows change months and date buttons select a day. The sparkle button suggests a plan from your tasks. Add starts a task for the selected date.' },
  { tab: 'Progress', title: 'Your progress buttons', description: 'Tap a day in the chart to see its completed tasks. Use the bottom tabs to return to Tasks or open Calendar and Settings.' },
  { tab: 'Settings', title: 'Your settings buttons', description: 'Save stores your display name; Light and Dark change appearance; the switches control preferences. Replay tutorial opens this guide again. Reset Sample Tasks replaces your list with examples. The top Focus button starts Focus Mode; the profile button opens Settings.' },
];
type TutorialBounds = { left: number; top: number; width: number; height: number };

export default function App() {
  const [tasks, setTasks] = useStoredState<Task[]>('flowtask.tasks', sampleTasks);
  const [theme, setTheme] = useStoredState<Theme>('flowtask.theme', 'light');
  const [displayName, setDisplayName] = useStoredState('flowtask.name', '');
  const [language, setLanguage] = useStoredState<AppLanguage>('flowtask.language', 'en');
  const [activeTab, setActiveTab] = useState<Tab>('Tasks');
  const [showTaskAssistant, setShowTaskAssistant] = useState(false);
  const [assistantPosition, setAssistantPosition] = useState({ x: 0, y: 0 });
  const assistantDrag = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const assistantMoved = useRef(false);
  const [onboardingDone, setOnboardingDone] = useStoredState('flowtask.onboarded', false);
  const [tutorialDone, setTutorialDone] = useStoredState('flowtask.tutorial.done', false);
  const [tutorialNeverAsk, setTutorialNeverAsk] = useStoredState('flowtask.tutorial.neverAsk', false);
  const [tutorialDismissedThisSession, setTutorialDismissedThisSession] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialNeverAskChecked, setTutorialNeverAskChecked] = useState(false);
  const [tutorialBounds, setTutorialBounds] = useState<TutorialBounds | null>(null);
  const [slide, setSlide] = useState(0);
  const [filter, setFilter] = useState('Today');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendarView, setCalendarView] = useState<CalendarView>('Month');
  const [showCalendarDrawer, setShowCalendarDrawer] = useState(false);
  const [calendarSearch, setCalendarSearch] = useState('');
  const [searchCalendar, setSearchCalendar] = useState(false);
  const [selectedWeekDay, setSelectedWeekDay] = useState(today);
  const [scheduleSuggestion, setScheduleSuggestion] = useState<{ date: string; scheduleKey: string; text: string } | null>(null);
  const [focusToast, setFocusToast] = useState(false);
  const [focusEnabled, setFocusEnabled] = useState(false);
  const [startupFinished, setStartupFinished] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState('');
  const [nameDraft, setNameDraft] = useState(displayName);
  const [notifications, setNotifications] = useStoredState('flowtask.notifications', true);
  const [dailyReminders, setDailyReminders] = useStoredState('flowtask.dailyReminders', false);
  const [reminderTime, setReminderTime] = useStoredState('flowtask.reminderTime', '09:00');
  const [sound, setSound] = useStoredState('flowtask.sound.enabled', true);
  const [weeklySummary, setWeeklySummary] = useStoredState('flowtask.summary', true);
  const [messages, setMessages] = useStoredState<ChatMessage[]>('flowtask.messages', [
    { id: 'welcome', from: 'assistant', text: 'Hi! I can recommend what to work on based on your tasks. Try asking “Anong magandang gawin ngayong araw?”' },
  ]);
  const [chatDraft, setChatDraft] = useState('');
  const showTutorial = onboardingDone && !tutorialDone && !tutorialNeverAsk && !tutorialDismissedThisSession;
  const tapAudio = useRef<HTMLAudioElement | null>(null);
  const locale = localeFor(language);

  useEffect(() => {
    const timer = window.setTimeout(() => setStartupFinished(true), 950);
    return () => window.clearTimeout(timer);
  }, []);

  function playTapSound(event: MouseEvent<HTMLDivElement>) {
    if (!sound || !(event.target instanceof Element)) return;
    const control = event.target.closest('button,[role="button"],[role="tab"],input[type="checkbox"],input[type="radio"]');
    if (!(control instanceof HTMLElement) || control.matches(':disabled') || control.getAttribute('aria-disabled') === 'true') return;

    if (!tapAudio.current) {
      tapAudio.current = new Audio(tapSoundUrl);
      tapAudio.current.volume = 0.16;
    }

    tapAudio.current.currentTime = 0;
    void tapAudio.current.play().catch(error => console.warn('Unable to play tap sound:', error));
  }

  function startAssistantDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    assistantDrag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: assistantPosition.x,
      originY: assistantPosition.y,
    };
    assistantMoved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveAssistantDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = assistantDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) assistantMoved.current = true;
    const phone = event.currentTarget.closest('.phone')?.getBoundingClientRect();
    if (!phone) return;
    setAssistantPosition({
      x: Math.max(-Math.max(0, phone.width - 82), Math.min(0, drag.originX + dx)),
      y: Math.max(-Math.max(0, phone.height - 170), Math.min(0, drag.originY + dy)),
    });
  }

  function finishAssistantDrag(event: PointerEvent<HTMLButtonElement>) {
    if (assistantDrag.current?.pointerId === event.pointerId) assistantDrag.current = null;
  }

  useEffect(() => {
    if (!showTutorial) return;
    const step = tutorialSteps[tutorialStep];
    const frame = window.requestAnimationFrame(() => {
      const phone = document.querySelector('.phone')?.getBoundingClientRect();
      const target = document.querySelector(`.nav-item[aria-label="${step.tab}"]`)?.getBoundingClientRect();
      if (phone && target) setTutorialBounds({
        left: target.left - phone.left,
        top: target.top - phone.top,
        width: target.width,
        height: target.height,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showTutorial, tutorialStep]);

  useEffect(() => {
    setTasks(current => {
      let changed = false;
      const normalized = current.map(task => {
        const priority = getTaskPriority(task);
        if (task.priority === priority && task.energy === undefined) return task;
        changed = true;
        const { energy, ...rest } = task;
        return { ...rest, priority };
      });
      return changed ? normalized : current;
    });
  }, [setTasks]);

  useEffect(() => {
    if (!notice && !focusToast) return;
    const timer = window.setTimeout(() => { setNotice(''); setFocusToast(false); }, 3200);
    return () => window.clearTimeout(timer);
  }, [notice, focusToast]);

  const dayTasks = tasks.filter(task => task.date === selectedDate);
  const completed = dayTasks.filter(task => task.completed).length;
  const progress = dayTasks.length ? Math.round((completed / dayTasks.length) * 100) : 0;
  const weekDays = getWeekDays(new Date(), language);
  const weekTaskList = tasks.filter(task => task.date >= weekDays[0].key && task.date <= weekDays[6].key);
  const weekCompleted = weekTaskList.filter(task => task.completed);
  const visibleTasks = useMemo(() => tasks.filter(task => {
    const textMatch = task.title.toLowerCase().includes(search.toLowerCase());
    const priorityMatch = priorityFilter === 'All' || getTaskPriority(task) === priorityFilter;
    const statusMatch = filter === 'All'
      || (filter === 'Today' && task.date === selectedDate)
      || (filter === 'Upcoming' && task.date > today && !task.completed)
      || (filter === 'Completed' && task.completed);
    return textMatch && priorityMatch && statusMatch;
  }).sort((a, b) => a.time.localeCompare(b.time)), [tasks, search, priorityFilter, filter, selectedDate]);
  const calendarTasks = tasks.filter(task => task.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const scheduleKey = JSON.stringify(calendarTasks.map(({ id, title, time, duration, category, priority, energy, completed, mood, notes }) => ({ id, title, time, duration, category, priority: priority ?? energy, completed, mood, notes })));
  const selectedDayTasks = tasks.filter(task => task.date === selectedWeekDay);
  const selectedDayDone = selectedDayTasks.filter(task => task.completed);
  const greetingName = displayName.trim() || 'Alex';

  function toggleTask(id: string) {
    setTasks(current => current.map(task => task.id === id ? { ...task, completed: !task.completed } : task));
  }
  function deleteTask(id: string) {
    setTasks(current => current.filter(task => task.id !== id));
  }
  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const title = String(data.get('title')).trim();
    const date = String(data.get('date'));
    const time = String(data.get('time'));
    const category = taskCategories.find(option => option.label === data.get('category'))?.label ?? 'Personal';
    const priority = taskPriorities.find(option => option.label === data.get('priority'))?.label ?? 'Medium';
    const mood = moodOptions.find(option => option.label === data.get('mood'))?.label;
    const notes = String(data.get('notes') ?? '').trim();
    if (!title || !date || !time) return;
    setTasks(current => [...current, {
      id: crypto.randomUUID(), title, date, time, duration: 30, category, priority, completed: false, mood, notes,
    }]);
    setSelectedDate(date);
    setShowAdd(false);
    setNotice('Task added to your day');
  }
  function finishOnboarding() {
    setOnboardingDone(true);
    setActiveTab('Tasks');
  }
  function dismissTutorial(completed: boolean) {
    if (tutorialNeverAskChecked) setTutorialNeverAsk(true);
    if (completed) setTutorialDone(true);
    setTutorialDismissedThisSession(true);
  }
  function advanceTutorial() {
    if (tutorialStep === tutorialSteps.length - 1) {
      dismissTutorial(true);
      return;
    }
    const nextStep = tutorialStep + 1;
    setTutorialStep(nextStep);
    setActiveTab(tutorialSteps[nextStep].tab);
  }
  function sendMessage(text = chatDraft) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), from: 'user', text: trimmed };
    const reply: ChatMessage = { id: crypto.randomUUID(), from: 'assistant', text: getTaskAssistantReply(trimmed, tasks) };
    setMessages(current => [...current, userMessage, reply]);
    setChatDraft('');
  }
  function planDay() {
    sendMessage('Anong magandang gawin ngayong araw?');
  }
  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = nameDraft.trim();
    if (!value) return;
    setDisplayName(value);
    setNotice('Your profile has been updated');
  }
  function resetTasks() {
    setTasks(sampleTasks);
    setSearch('');
    setFilter('Today');
    setPriorityFilter('All');
    setNotice('Your sample tasks are back');
  }
  function changeCalendarMonth(offset: number) {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    const day = new Date(`${selectedDate}T12:00:00`).getDate();
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    setMonth(nextMonth);
    setSelectedDate(dateKey(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(day, lastDay))));
  }
  function suggestFromSchedule() {
    setScheduleSuggestion({ date: selectedDate, scheduleKey, text: makeTaskSuggestion(calendarTasks) });
  }

  return (
    <div className={`stage ${theme}`} data-theme={theme}>
      <div className="phone" onClickCapture={playTapSound}>
        <header className="topbar">
          <div className="header-actions">
            <button className="icon-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} /></button>
            <button className="focus-button" aria-label={focusEnabled ? localize(language, 'Turn Focus off', 'I-off ang focus') : localize(language, 'Turn Focus on', 'I-on ang focus')} aria-pressed={focusEnabled} onClick={() => { setFocusEnabled(value => !value); setFocusToast(true); }}><Icon name="target" size={16} /><span>{localize(language, focusEnabled ? 'Focus: On' : 'Focus: Off', focusEnabled ? 'Pokus: Naka-on' : 'Pokus: Naka-off')}</span></button>
            <button className="avatar" aria-label={localize(language, 'Open settings', 'Buksan ang settings')} onClick={() => setActiveTab('Settings')}>{displayName.trim().slice(0, 1).toUpperCase() || 'A'}</button>
          </div>
        </header>

        <main className="content" key={activeTab}>
          {activeTab === 'Tasks' && <section className="screen tasks-screen">
            <div className="page-heading">
              <div><p className="eyebrow">{new Date().toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1>{localize(language, 'Welcome back,', 'Maligayang pagbabalik,')}<br />{greetingName} <Icon className="wave" name="sparkles" size={18} /></h1><p className="subheading">{localize(language, 'A fresh day to make progress at your pace.', 'Bagong araw para umusad sa sarili mong bilis.')}</p></div>
              <button className="add-button" onClick={() => setShowAdd(true)}><Icon name="plus" size={17} color="#2D7655" /><span>{localize(language, 'Add task', 'Magdagdag')}</span></button>
            </div>
            <DateStrip selected={selectedDate} onSelect={setSelectedDate} language={language} />
            <section className="progress-card">
              <div className="progress-top"><div><p className="card-kicker">{localize(language, 'DAILY PROGRESS', 'PAG-UNLAD NGAYONG ARAW')}</p><p className="progress-count"><strong>{completed}</strong><span> {localize(language, `of ${dayTasks.length} tasks completed`, `sa ${dayTasks.length} gawain na natapos`)}</span></p></div><div className="progress-percent">{progress}%</div></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
              <p className="progress-caption">{progress === 100 ? localize(language, 'Everything done. Take a well-earned breath.', 'Tapos na ang lahat. Magpahinga ka muna.') : localize(language, 'You’re finding your flow. Keep it up!', 'Dahan-dahan lang. Magpatuloy sa sarili mong ritmo!')}</p>
            </section>
            <div className="section-title-row"><div><h2>{localize(language, 'Your tasks', 'Mga gawain mo')}</h2><span className="task-count">{visibleTasks.length} {localize(language, visibleTasks.length === 1 ? 'task' : 'tasks', 'gawain')}</span></div><button className="text-button" onClick={() => { setFilter('All'); setPriorityFilter('All'); }}>{localize(language, 'View all', 'Tingnan lahat')}</button></div>
            <label className="search-field"><Icon name="search" size={17} /><input aria-label={localize(language, 'Search tasks', 'Maghanap ng gawain')} value={search} onChange={event => setSearch(event.target.value)} placeholder={localize(language, 'Search your tasks', 'Maghanap ng gawain')} />{search && <button aria-label={localize(language, 'Clear search', 'I-clear ang paghahanap')} onClick={() => setSearch('')}><Icon name="close" size={15} /></button>}</label>
            <div className="filter-row" aria-label={localize(language, 'Task status filters', 'Mga filter ng gawain')}>{['Today', 'All', 'Upcoming', 'Completed'].map(item => <button key={item} className={`filter-pill ${filter === item ? 'selected' : ''}`} onClick={() => setFilter(item)}>{localize(language, item, item === 'Today' ? 'Ngayon' : item === 'All' ? 'Lahat' : item === 'Upcoming' ? 'Paparating' : 'Tapos na')}</button>)}</div>
            <div className="priority-row"><span>{localize(language, 'PRIORITY', 'PRAYORIDAD')}</span>{['All', 'Low', 'Medium', 'High'].map(item => <button key={item} className={`priority-pill ${priorityFilter === item ? 'selected' : ''} ${item.toLowerCase()}`} onClick={() => setPriorityFilter(item)}>{localize(language, item, item === 'All' ? 'Lahat' : item === 'Low' ? 'Mababa' : item === 'Medium' ? 'Katamtaman' : 'Mataas')}</button>)}</div>
            <div className="task-list">{visibleTasks.map(task => <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} language={language} />)}
              {visibleTasks.length === 0 && <div className="empty-state"><div className="empty-icon"><Icon name="leaf" size={23} /></div><strong>{localize(language, 'Nothing on this list', 'Walang laman ang listahang ito')}</strong><p>{localize(language, 'Try a different filter or add a new task to get started.', 'Sumubok ng ibang filter o magdagdag ng gawain para makapagsimula.')}</p><button className="text-button" onClick={() => setShowAdd(true)}>{localize(language, 'Add a task', 'Magdagdag ng gawain')} <Icon name="arrow-right" size={14} /></button></div>}
            </div>
          </section>}

          {activeTab === 'Calendar' && <section className="screen calendar-screen">
            <div className="calendar-toolbar">
              <button className="icon-button" aria-label="Open calendar views" onClick={() => setShowCalendarDrawer(true)}><Icon name="menu" /></button>
              <h1>{localize(language, 'Calendar', 'Kalendaryo')}</h1>
              <button className="icon-button" aria-label="Search calendar" onClick={() => { setSearchCalendar(value => !value); setCalendarSearch(''); }}><Icon name="search" /></button>
              <button className="today-button" onClick={() => { setMonth(new Date()); setSelectedDate(today); }}><span>{localize(language, 'Today', 'Ngayon')}</span><strong>{new Date().getDate()}</strong></button>
            </div>
            {searchCalendar && <label className="search-field calendar-search"><Icon name="search" size={16} /><input autoFocus aria-label="Search scheduled tasks" value={calendarSearch} onChange={event => setCalendarSearch(event.target.value)} placeholder="Find a task or date" /><button aria-label="Close calendar search" onClick={() => { setSearchCalendar(false); setCalendarSearch(''); }}><Icon name="close" size={15} /></button></label>}
            <section className="suggestion-card">
              <div className="suggestion-heading"><span className="suggestion-icon"><Icon name="sparkles" size={16} /></span><strong>Suggestions</strong></div>
              <p>{scheduleSuggestion?.date === selectedDate && scheduleSuggestion.scheduleKey === scheduleKey
                ? scheduleSuggestion.text
                : `Get a planning idea based on your tasks for ${prettyDate(selectedDate)}.`}</p>
              <button className="suggestion-button" aria-label={`Suggest based on tasks for ${prettyDate(selectedDate)}`} title="Suggest based on my schedule" onClick={suggestFromSchedule}><Icon name="sparkles" size={16} /></button>
            </section>
            {calendarView === 'Month' && <>
              <section className="calendar-month-card" aria-label="Monthly calendar">
                <div className="month-heading"><button className="icon-button" aria-label="Previous month" onClick={() => changeCalendarMonth(-1)}><Icon name="chevron-left" /></button><h2>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2><button className="icon-button" aria-label="Next month" onClick={() => changeCalendarMonth(1)}><Icon name="chevron-right" /></button></div>
                <CalendarMonthGrid month={month} selected={selectedDate} tasks={tasks} language={language} onSelect={date => { setSelectedDate(date); setMonth(new Date(`${date}T12:00:00`)); }} />
              </section>
              <CalendarAgenda date={selectedDate} tasks={calendarTasks.filter(task => task.title.toLowerCase().includes(calendarSearch.toLowerCase()))} onToggle={toggleTask} onDelete={deleteTask} onAdd={() => setShowAdd(true)} language={language} largeDate />
            </>}
            {calendarView === 'Year' && <div className="year-grid">{Array.from({ length: 12 }, (_, index) => {
              const yearMonth = new Date(month.getFullYear(), index, 1);
              const taskCount = tasks.filter(task => task.date.startsWith(`${yearMonth.getFullYear()}-${String(index + 1).padStart(2, '0')}`)).length;
              return <button key={index} className={`year-month ${yearMonth.getMonth() === month.getMonth() ? 'selected' : ''}`} onClick={() => {
                const day = new Date(`${selectedDate}T12:00:00`).getDate();
                const lastDay = new Date(yearMonth.getFullYear(), index + 1, 0).getDate();
                setSelectedDate(dateKey(new Date(yearMonth.getFullYear(), index, Math.min(day, lastDay))));
                setMonth(yearMonth);
                setCalendarView('Month');
              }}>
                <strong>{yearMonth.toLocaleDateString('en-US', { month: 'short' })}</strong><span>{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span><CalendarMiniMonth month={yearMonth} />
              </button>;
            })}</div>}
            {calendarView === 'Week' && <>
              <CalendarWeekStrip selected={selectedDate} tasks={tasks} language={language} onSelect={setSelectedDate} />
              <CalendarAgenda date={selectedDate} tasks={calendarTasks.filter(task => task.title.toLowerCase().includes(calendarSearch.toLowerCase()))} onToggle={toggleTask} onDelete={deleteTask} onAdd={() => setShowAdd(true)} language={language} />
            </>}
            {calendarView === 'Day' && <CalendarAgenda date={selectedDate} tasks={calendarTasks.filter(task => task.title.toLowerCase().includes(calendarSearch.toLowerCase()))} onToggle={toggleTask} onDelete={deleteTask} onAdd={() => setShowAdd(true)} language={language} largeDate />}
            {calendarView === 'Schedule' && <CalendarSchedule tasks={tasks.filter(task => task.title.toLowerCase().includes(calendarSearch.toLowerCase()))} onToggle={toggleTask} onDelete={deleteTask} language={language} />}
            {showCalendarDrawer && <CalendarDrawer selected={calendarView} tasks={tasks} onClose={() => setShowCalendarDrawer(false)} onSelect={view => { setCalendarView(view); setShowCalendarDrawer(false); }} />}
            <button className="calendar-fab" onClick={() => setShowAdd(true)}><span>Add on {prettyDate(selectedDate)}</span><span className="calendar-fab-plus"><Icon name="plus" size={20} /></span></button>
          </section>}

          {activeTab === 'Progress' && <section className="screen weekly-screen">
            <div className="page-heading compact"><div><p className="eyebrow">{localize(language, 'YOUR PROGRESS', 'IYONG PAG-UNLAD')}</p><h1>{localize(language, 'Progress', 'Pag-unlad')}</h1><p className="subheading">{prettyDate(weekDays[0].key, undefined, language)} – {prettyDate(weekDays[6].key, { month: 'short', day: 'numeric', year: 'numeric' }, language)}</p></div><div className="round-spark"><Icon name="chart" size={20} /></div></div>
            <section className="weekly-summary"><div className="weekly-summary-icon"><Icon name="chart" size={19} /></div><div className="weekly-summary-copy"><span>{localize(language, 'PROGRESS OVERVIEW', 'BUOD NG PAG-UNLAD')}</span><strong>{localize(language, 'Your progress, at a glance', 'Buod ng iyong pag-unlad')}</strong><small>{localize(language, `${weekCompleted.length} of ${weekTaskList.length} planned tasks completed this week`, `${weekCompleted.length} sa ${weekTaskList.length} nakaplanong gawain ang natapos ngayong linggo`)}</small></div><div className="weekly-summary-rate">{weekTaskList.length ? Math.round((weekCompleted.length / weekTaskList.length) * 100) : 0}%</div></section>
            <div className="stats-grid"><div className="stat-card"><div className="stat-icon mint"><Icon name="check-circle" size={17} /></div><p>Tasks completed</p><strong>{weekCompleted.length}<small> / {weekTaskList.length}</small></strong><span>Keep your momentum</span></div><div className="stat-card"><div className="stat-icon lavender"><Icon name="clock" size={17} /></div><p>Focus time</p><strong>{Math.floor(weekCompleted.reduce((sum, task) => sum + task.duration, 0) / 60)}<small>h {weekCompleted.reduce((sum, task) => sum + task.duration, 0) % 60}m</small></strong><span>Time well spent</span></div></div>
            <div className="chart-card"><div className="section-title-row"><div><h2>Your activity</h2><p className="subheading">Completed tasks each day</p></div><span className="chart-badge"><span /> This week</span></div><div className="chart-area"><div className="chart-guides"><span>4</span><span>3</span><span>2</span><span>1</span><span>0</span></div><div className="bar-chart">{weekDays.map(day => { const count = tasks.filter(task => task.date === day.key && task.completed).length; const height = `${Math.max(8, (count / Math.max(4, ...weekDays.map(d => tasks.filter(task => task.date === d.key && task.completed).length))) * 100)}%`; return <button key={day.key} className={`bar-column ${selectedWeekDay === day.key ? 'active' : ''}`} onClick={() => setSelectedWeekDay(day.key)} aria-label={`${day.label}, ${count} tasks completed`}><span className="bar-number" style={{ bottom: `calc(${height} + 22px)` }}>{count || ''}</span><span className="bar" style={{ height }} /><span className="bar-label">{day.short}</span></button>; })}</div></div><p className="chart-caption"><Icon name="sparkles" size={14} /> Small steps add up. You’re doing great.</p></div>
            <section className="day-detail"><div className="section-title-row"><div><p className="card-kicker">DAY IN FOCUS</p><h2>{prettyDate(selectedWeekDay, { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div><span className="done-tag">{selectedDayDone.length} completed</span></div>{selectedDayDone.length ? selectedDayDone.map(task => <div className="detail-task" key={task.id}><span className="mini-check"><Icon name="check" size={13} /></span><span>{task.title}</span><time>{task.time}</time></div>) : <p className="detail-empty">No completed tasks on this day yet. Every day is a fresh start.</p>}</section>
          </section>}

          {activeTab === 'Assistant' && <section className="screen assistant-screen">
            <div className="page-heading compact assistant-heading"><div><p className="eyebrow">A THOUGHTFUL SIDEKICK</p><h1>Assistant</h1><p className="subheading">A calmer day starts with a conversation.</p></div><div className="assistant-avatar"><Icon name="sparkles" size={19} /></div></div>
            <div className="chat-surface"><div className="assistant-status"><span className="status-dot" /> FLOWTASK ASSISTANT</div><div className="messages">{messages.map(message => <div key={message.id} className={`message-row ${message.from}`}><div className="message-avatar">{message.from === 'assistant' ? <Icon name="sparkles" size={15} /> : greetingName.slice(0, 1).toUpperCase()}</div><div className="message-bubble">{message.text}</div></div>)}</div><div className="chat-actions"><button onClick={planDay}><Icon name="sparkles" size={15} /> Let’s plan my day</button><button onClick={() => sendMessage('Help me find a little more focus today')}><Icon name="target" size={15} /> Find my focus</button></div><form className="chat-composer" onSubmit={event => { event.preventDefault(); sendMessage(); }}><input aria-label="Message your planner" value={chatDraft} onChange={event => setChatDraft(event.target.value)} placeholder="Ask me anything..." /><button className="send-button" type="submit" disabled={!chatDraft.trim()} aria-label="Send message"><Icon name="send" size={17} /></button></form><p className="chat-footnote">Your planner is here to help you find your flow.</p></div>
          </section>}

          {activeTab === 'Settings' && <section className="screen settings-screen">
            <div className="page-heading compact"><div><p className="eyebrow">{localize(language, 'MAKE IT YOURS', 'IANGKOP SA IYO')}</p><h1>{localize(language, 'Settings', 'Mga Setting')}</h1><p className="subheading">{localize(language, 'A space that feels like you.', 'Isang espasyong para sa iyo.')}</p></div><div className="round-spark"><Icon name="settings" size={19} /></div></div>
            <form className="settings-card profile-form" onSubmit={saveName}><div className="settings-card-head"><div className="settings-icon"><Icon name="user" size={18} /></div><div><h2>{localize(language, 'Your profile', 'Iyong profile')}</h2><p>{localize(language, 'How should we say hello?', 'Anong pangalan ang itatawag namin sa iyo?')}</p></div></div><label className="field-label" htmlFor="display-name">{localize(language, 'Display name', 'Pangalan')}</label><div className="name-field"><input id="display-name" value={nameDraft} onChange={event => setNameDraft(event.target.value)} placeholder={localize(language, 'Your name', 'Iyong pangalan')} maxLength={32} /><button type="submit" aria-label={localize(language, 'Save display name', 'I-save ang pangalan')}><Icon name="check" size={16} /></button></div></form>
            <section className="settings-card"><div className="settings-card-head"><div className="settings-icon"><Icon name="user" size={18} /></div><div><h2>{localize(language, 'Language', 'Wika')}</h2><p>{localize(language, 'Choose English or Tagalog.', 'Pumili ng English o Tagalog.')}</p></div></div><div className="appearance-options" role="radiogroup" aria-label={localize(language, 'Language', 'Wika')}><button type="button" role="radio" aria-checked={language === 'en'} className={language === 'en' ? 'chosen' : ''} onClick={() => setLanguage('en')}>English</button><button type="button" role="radio" aria-checked={language === 'tl'} className={language === 'tl' ? 'chosen' : ''} onClick={() => setLanguage('tl')}>Tagalog</button></div></section>
            <section className="settings-card"><div className="settings-card-head"><div className="settings-icon"><Icon name="sun" size={18} /></div><div><h2>{localize(language, 'Appearance', 'Hitsura')}</h2><p>{localize(language, 'Choose your preferred look.', 'Piliin ang gusto mong itsura.')}</p></div></div><div className="appearance-options"><button type="button" className={theme === 'dark' ? 'chosen' : ''} onClick={() => setTheme('dark')}><Icon name="moon" size={16} /> {localize(language, 'Dark', 'Madilim')}</button><button type="button" className={theme === 'light' ? 'chosen' : ''} onClick={() => setTheme('light')}><Icon name="sun" size={16} /> {localize(language, 'Light', 'Maliwanag')}</button></div></section>
            <section className="settings-card preference-card"><div className="settings-card-head"><div className="settings-icon"><Icon name="bell" size={18} /></div><div><h2>{localize(language, 'Your preferences', 'Mga kagustuhan')}</h2><p>{localize(language, 'Only the nudges you want.', 'Piliin lang ang mga paalala na gusto mo.')}</p></div></div><ToggleRow icon="bell" label={localize(language, 'Notifications', 'Mga notification')} checked={notifications} onChange={setNotifications} /><ToggleRow icon="bell" label={localize(language, 'Daily reminder', 'Pang-araw-araw na paalala')} checked={dailyReminders} onChange={setDailyReminders} /><div className={`reminder-time-row ${dailyReminders ? 'enabled' : ''}`}><label htmlFor="daily-reminder-time">{localize(language, 'Reminder time', 'Oras ng paalala')}</label><input id="daily-reminder-time" type="time" value={reminderTime} disabled={!dailyReminders} onChange={event => setReminderTime(event.target.value)} /></div>{dailyReminders && <p className="reminder-note">{localize(language, 'Scheduled reminders are delivered by the Android app.', 'Ang mga naka-iskedyul na paalala ay ipinapadala ng Android app.')}</p>}<ToggleRow icon="volume" label={localize(language, 'Sounds', 'Mga tunog')} checked={sound} onChange={setSound} /><ToggleRow icon="chart" label={localize(language, 'Weekly summary', 'Buod kada linggo')} checked={weeklySummary} onChange={setWeeklySummary} last /></section>
            <section className="settings-card reset-card"><div><h2>{localize(language, 'Start fresh', 'Magsimula muli')}</h2><p>{localize(language, 'Bring back the original sample tasks.', 'Ibalik ang mga orihinal na halimbawang gawain.')}</p></div><button className="reset-button" onClick={resetTasks}><Icon name="trash" size={14} /> {localize(language, 'Reset Sample Tasks', 'Ibalik ang mga halimbawang gawain')}</button></section>
            <button className="text-button tutorial-replay" onClick={() => { setTutorialDone(false); setTutorialNeverAsk(false); setTutorialDismissedThisSession(false); setTutorialStep(0); setTutorialNeverAskChecked(false); setActiveTab('Tasks'); }}>{localize(language, 'Replay tutorial', 'Ulitin ang gabay')}</button>
            <p className="settings-footer"><Icon name="bolt" size={13} /> {localize(language, 'A little more flow, every day.', 'Mas maayos na araw, araw-araw.')}</p>
          </section>}
        </main>

        {activeTab === 'Tasks' && <button
          className="task-assistant-fab"
          aria-label={localize(language, 'Open your AI day planner', 'Buksan ang AI day planner')}
          title={localize(language, 'Ask your day planner', 'Magtanong sa day planner mo')}
          style={{ transform: `translate(${assistantPosition.x}px, ${assistantPosition.y}px)` }}
          onPointerDown={startAssistantDrag}
          onPointerMove={moveAssistantDrag}
          onPointerUp={finishAssistantDrag}
          onPointerCancel={finishAssistantDrag}
          onClick={() => {
            if (assistantMoved.current) {
              assistantMoved.current = false;
              return;
            }
            setShowTaskAssistant(true);
          }}
        ><Icon name="sparkles" size={21} /></button>}
        <nav className="bottom-nav" aria-label={localize(language, 'Main navigation', 'Pangunahing nabigasyon')}>{navItems.map(item => <button key={item.label} className={`nav-item ${activeTab === item.label ? 'active' : ''}`} aria-label={item.label} aria-current={activeTab === item.label ? 'page' : undefined} onClick={() => { setShowTaskAssistant(false); if (item.label === 'Calendar') setMonth(new Date(`${selectedDate}T12:00:00`)); setActiveTab(item.label); }}><span className="nav-icon"><Icon name={item.icon} size={19} /></span><span>{localize(language, item.label, item.label === 'Tasks' ? 'Mga gawain' : item.label === 'Calendar' ? 'Kalendaryo' : item.label === 'Progress' ? 'Pag-unlad' : 'Mga Setting')}</span></button>)}</nav>
        {showTaskAssistant && activeTab === 'Tasks' && <div className="task-assistant-backdrop" onClick={() => setShowTaskAssistant(false)}>
          <section className="task-assistant-panel" role="dialog" aria-modal="true" aria-label={localize(language, 'AI day planner', 'AI day planner')} onClick={event => event.stopPropagation()}>
            <div className="task-assistant-heading">
              <span className="assistant-avatar"><Icon name="sparkles" size={18} /></span>
              <div><strong>{localize(language, 'Your day planner', 'Day planner mo')}</strong><small>{localize(language, 'Based on your tasks · works offline', 'Batay sa mga gawain mo · gumagana offline')}</small></div>
              <button className="icon-button" aria-label={localize(language, 'Close day planner', 'Isara ang day planner')} onClick={() => setShowTaskAssistant(false)}><Icon name="close" size={17} /></button>
            </div>
            <div className="task-assistant-privacy"><Icon name="leaf" size={14} /> {localize(language, 'No internet or API token needed. Your tasks stay in this browser.', 'Hindi kailangan ng internet o API token. Nananatili sa browser na ito ang mga gawain mo.')}</div>
            <div className="task-assistant-messages" aria-live="polite">
              {messages.map(message => <div key={message.id} className={`message-row ${message.from}`}><div className="message-avatar">{message.from === 'assistant' ? <Icon name="sparkles" size={14} /> : greetingName.slice(0, 1).toUpperCase()}</div><div className="message-bubble">{message.text}</div></div>)}
            </div>
            <div className="chat-actions">
              <button onClick={planDay}><Icon name="sparkles" size={14} /> {localize(language, 'Recommend for today', 'Magrekomenda para ngayon')}</button>
              <button onClick={() => sendMessage('Help me find a good work task to focus on')}><Icon name="target" size={14} /> {localize(language, 'Find my work focus', 'Tulungan akong magpokus sa trabaho')}</button>
            </div>
            <form className="chat-composer" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
              <input aria-label={localize(language, 'Ask your day planner', 'Magtanong sa day planner mo')} value={chatDraft} onChange={event => setChatDraft(event.target.value)} placeholder={localize(language, 'Ask about your tasks...', 'Magtanong tungkol sa mga gawain mo...')} />
              <button className="send-button" type="submit" disabled={!chatDraft.trim()} aria-label={localize(language, 'Send message', 'Ipadala ang mensahe')}><Icon name="send" size={16} /></button>
            </form>
          </section>
        </div>}
        {(focusToast || notice) && <div role="status" className="toast"><span className="toast-icon"><Icon name={focusToast ? 'target' : 'check'} size={15} /></span>{focusToast ? localize(language, focusEnabled ? 'Focus mode is on. One thing at a time.' : 'Focus mode is off.', focusEnabled ? 'Naka-on ang focus mode. Isang gawain muna.' : 'Naka-off ang focus mode.') : notice}<button aria-label={localize(language, 'Dismiss notification', 'Isara ang abiso')} onClick={() => { setFocusToast(false); setNotice(''); }}><Icon name="close" size={15} /></button></div>}
        {showAdd && <AddTaskSheet language={language} onClose={() => setShowAdd(false)} onSubmit={addTask} />}
        {!onboardingDone && <Onboarding slide={slide} setSlide={setSlide} displayName={displayName} setDisplayName={value => { setDisplayName(value); setNameDraft(value); }} onFinish={finishOnboarding} />}
        {showTutorial && tutorialBounds && <TutorialOverlay
          bounds={tutorialBounds}
          step={tutorialStep}
          neverAskAgain={tutorialNeverAskChecked}
          onNeverAskAgain={setTutorialNeverAskChecked}
          onNext={advanceTutorial}
          onSkip={() => dismissTutorial(false)}
        />}
        {!startupFinished && <StartupSplash />}
      </div>
    </div>
  );
}

function getWeekDays(reference: Date, language: AppLanguage = 'en') {
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(reference, mondayOffset + index);
    return { key: dateKey(date), label: date.toLocaleDateString(localeFor(language), { weekday: 'long' }), short: date.toLocaleDateString(localeFor(language), { weekday: 'short' }), number: date.getDate() };
  });
}

function DateStrip({ selected, onSelect, language }: { selected: string; onSelect: (date: string) => void; language: AppLanguage }) {
  const reference = new Date(`${selected}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(reference, index - 3);
    return { key: dateKey(date), short: date.toLocaleDateString(localeFor(language), { weekday: 'short' }), number: date.getDate(), isToday: dateKey(date) === today };
  });
  return <div className="date-strip" role="group" aria-label={localize(language, 'Choose a date', 'Pumili ng petsa')}>{days.map(day => <button key={day.key} className={`date-cell ${selected === day.key ? 'selected' : ''}`} onClick={() => onSelect(day.key)} aria-label={`${day.short}, ${prettyDate(day.key, undefined, language)}`} aria-pressed={selected === day.key}><span>{day.short}</span><strong>{day.number}</strong>{day.isToday && <i />}</button>)}</div>;
}

function CalendarMonthGrid({ month, selected, tasks, language, onSelect }: { month: Date; selected: string; tasks: Task[]; language: AppLanguage; onSelect: (date: string) => void }) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstDay, index - offset);
    const key = dateKey(date);
    const dayTasks = tasks.filter(task => task.date === key);
    return { key, number: date.getDate(), inMonth: date.getMonth() === month.getMonth(), taskCount: dayTasks.length, completedCount: dayTasks.filter(task => task.completed).length };
  });
  return <div className="month-grid-wrap"><div className="month-weekdays" aria-hidden="true">{(language === 'tl' ? ['Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab', 'Lin'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map(day => <span key={day}>{day}</span>)}</div><div className="month-grid">{days.map(day => <button key={day.key} className={`month-day ${selected === day.key ? 'selected' : ''} ${!day.inMonth ? 'out-month' : ''} ${day.key === today ? 'today' : ''}`} onClick={() => onSelect(day.key)} aria-label={`${prettyDate(day.key, { weekday: 'long', month: 'long', day: 'numeric' }, language)}${day.taskCount ? `, ${day.taskCount} ${day.taskCount === 1 ? localize(language, 'task', 'gawain') : localize(language, 'tasks', 'gawain')}` : ''}`} aria-pressed={selected === day.key}><span className="month-day-number">{day.number}</span>{day.taskCount > 0 && <span className="month-day-dots" aria-hidden="true">{Array.from({ length: Math.min(day.taskCount, 3) }, (_, index) => <i key={index} className={index < day.completedCount ? 'complete' : ''} />)}</span>}</button>)}</div></div>;
}

function CalendarAgenda({ date, tasks, onToggle, onDelete, onAdd, language, largeDate = false }: { date: string; tasks: Task[]; onToggle: (id: string) => void; onDelete: (id: string) => void; onAdd: () => void; language: AppLanguage; largeDate?: boolean }) {
  const parsedDate = new Date(`${date}T12:00:00`);
  return <section className={`calendar-agenda ${largeDate ? 'large-date' : ''}`}>
    <div className="agenda-heading">
      {largeDate && <strong className="agenda-date-number">{parsedDate.getDate()}</strong>}
      <div><p className="card-kicker">{parsedDate.toLocaleDateString(localeFor(language), { weekday: 'long' }).toUpperCase()}</p><h2>{prettyDate(date, { month: 'long', day: 'numeric', year: 'numeric' }, language)}</h2></div>
      <span className="day-count">{tasks.length} {localize(language, tasks.length === 1 ? 'task' : 'tasks', 'gawain')}</span>
    </div>
    {tasks.length
      ? <div className="task-list calendar-list">{tasks.slice().sort((a, b) => a.time.localeCompare(b.time)).map(task => <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} language={language} />)}</div>
      : <div className="empty-state calendar-empty"><div className="empty-icon"><Icon name="calendar" size={23} /></div><strong>{localize(language, 'Your day is open', 'May bakante ka pa')}</strong><p>{localize(language, 'Add a task when you’re ready to give this day a little shape.', 'Magdagdag ng gawain kapag handa ka nang magplano para sa araw na ito.')}</p><button className="text-button" onClick={onAdd}>{localize(language, 'Plan something', 'Magplano')} <Icon name="arrow-right" size={14} /></button></div>}
  </section>;
}

function makeTaskSuggestion(tasks: Task[]) {
  const ordered = tasks.slice().sort((a, b) => a.time.localeCompare(b.time));
  const unfinished = ordered.filter(task => !task.completed);

  if (!ordered.length) {
    return 'No tasks are scheduled for this day. Add a task in Your Tasks to get a suggestion based on what you need to do.';
  }
  if (!unfinished.length) {
    return `You’ve completed ${ordered.map(task => `“${task.title}”`).join(', ')}. Take a break or plan your next task.`;
  }

  const nextTask = unfinished[0];
  const taskDetails = (task: Task) => [
    task.category && task.category !== 'Personal' ? task.category : '',
    `${getTaskPriority(task).toLowerCase()} priority`,
    `${task.duration}-minute`,
  ].filter(Boolean).join(', ');
  const openGap = ordered.slice(0, -1).map((task, index) => {
    const [hours, minutes] = task.time.split(':').map(Number);
    const [nextHours, nextMinutes] = ordered[index + 1].time.split(':').map(Number);
    return { task, nextTask: ordered[index + 1], minutes: nextHours * 60 + nextMinutes - hours * 60 - minutes - task.duration };
  }).filter(gap => gap.minutes >= 20 && !gap.nextTask.completed)
    .sort((a, b) => b.minutes - a.minutes)[0];

  if (openGap) {
    return `After “${openGap.task.title},” you have a ${openGap.minutes}-minute gap before “${openGap.nextTask.title}” at ${openGap.nextTask.time}. Take a short break, then get ready for this ${taskDetails(openGap.nextTask)} task.`;
  }
  if (unfinished.length === 1) {
    return `Focus on “${nextTask.title}” at ${nextTask.time}. It’s a ${taskDetails(nextTask)} task, so prepare what you need and give it your attention.`;
  }
  return `Start with “${nextTask.title}” at ${nextTask.time} (${taskDetails(nextTask)}), then move on to “${unfinished[1].title}” at ${unfinished[1].time}.`;
}

function CalendarWeekStrip({ selected, tasks, language, onSelect }: { selected: string; tasks: Task[]; language: AppLanguage; onSelect: (date: string) => void }) {
  const days = getWeekDays(new Date(`${selected}T12:00:00`), language);
  return <div className="calendar-week-strip" role="group" aria-label="Choose a day in this week">{days.map(day => {
    const hasTasks = tasks.some(task => task.date === day.key);
    return <button key={day.key} className={`week-date-card ${selected === day.key ? 'selected' : ''}`} onClick={() => onSelect(day.key)} aria-pressed={selected === day.key}>
      <span>{day.short.slice(0, 1)}</span><strong>{day.number}</strong>{hasTasks && <i />}
    </button>;
  })}</div>;
}

function CalendarMiniMonth({ month }: { month: Date }) {
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return <span className="mini-month-grid" aria-hidden="true">{Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return <i key={index} className={day > 0 && day <= count ? '' : 'blank'}>{day > 0 && day <= count ? day : ''}</i>;
  })}</span>;
}

function CalendarSchedule({ tasks, onToggle, onDelete, language }: { tasks: Task[]; onToggle: (id: string) => void; onDelete: (id: string) => void; language: AppLanguage }) {
  const scheduled = tasks.slice().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const groups = Array.from(new Set(scheduled.map(task => task.date)));
  return <div className="schedule-view">
    {groups.length ? groups.map(date => <section className="schedule-group" key={date}>
      <h2>{prettyDate(date, { weekday: 'long', month: 'long', day: 'numeric' }, language).toUpperCase()}</h2>
      <div className="task-list">{scheduled.filter(task => task.date === date).map(task => <TaskCard key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} language={language} />)}</div>
    </section>) : <div className="empty-state"><div className="empty-icon"><Icon name="calendar" size={23} /></div><strong>{localize(language, 'Your schedule is clear', 'Walang nakatakdang gawain')}</strong><p>{localize(language, 'Scheduled tasks will appear here, organized by date.', 'Lalabas dito ang mga gawain mo ayon sa petsa.')}</p></div>}
  </div>;
}

function CalendarDrawer({ selected, tasks, onClose, onSelect }: { selected: CalendarView; tasks: Task[]; onClose: () => void; onSelect: (view: CalendarView) => void }) {
  const views: { label: CalendarView; icon: IconName }[] = [
    { label: 'Year', icon: 'chart' },
    { label: 'Month', icon: 'calendar' },
    { label: 'Week', icon: 'week' },
    { label: 'Day', icon: 'circle' },
    { label: 'Schedule', icon: 'clock' },
  ];
  return <div className="calendar-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="calendar-drawer" role="dialog" aria-modal="true" aria-label="Calendar views">
      <div className="drawer-heading"><div className="drawer-brand"><span className="brand-mark"><Icon name="bolt" size={17} /></span><strong>Calendar</strong></div><button className="icon-button" aria-label="Close calendar views" onClick={onClose}><Icon name="close" /></button></div>
      <p className="card-kicker drawer-label">VIEW</p>
      <nav className="drawer-views" aria-label="Calendar view">
        {views.map(view => <button key={view.label} className={`drawer-view ${selected === view.label ? 'selected' : ''}`} onClick={() => onSelect(view.label)}><Icon name={view.icon} size={18} /><span>{view.label}</span>{selected === view.label && <Icon className="drawer-check" name="check" size={16} />}</button>)}
      </nav>
      <div className="drawer-workspace"><span className="brand-mark"><Icon name="bolt" size={15} /></span><div><strong>My workspace</strong><span>{tasks.length} scheduled {tasks.length === 1 ? 'task' : 'tasks'}</span></div></div>
    </aside>
  </div>;
}

function TaskCard({ task, onToggle, onDelete, language = 'en' }: { task: Task; onToggle: (id: string) => void; onDelete: (id: string) => void; language?: AppLanguage }) {
  const moodIcon = moodOptions.find(option => option.label === task.mood)?.icon;
  return <article className={`task-card ${task.completed ? 'is-complete' : ''}`}>
    <button className={`task-check ${task.completed ? 'checked' : ''}`} aria-label={task.completed ? `${localize(language, 'Mark', 'Markahang')} ${task.title} ${localize(language, 'incomplete', 'hindi tapos')}` : `${localize(language, 'Complete', 'Kumpletuhin')} ${task.title}`} aria-pressed={task.completed} onClick={() => onToggle(task.id)}>{task.completed && <Icon name="check" size={14} />}</button>
    <div className="task-main"><div className="task-title-line"><h3>{task.title}</h3><button className="delete-task" aria-label={`${localize(language, 'Delete', 'Burahin')} ${task.title}`} onClick={() => onDelete(task.id)}><Icon name="trash" size={15} /></button></div><div className="task-metadata"><span><Icon name="calendar" size={12} />{prettyDate(task.date, undefined, language)}</span><span><Icon name="clock" size={12} />{task.time}</span><span>{task.duration} {localize(language, 'min', 'min')}</span></div><div className="task-tags"><span className={`category-tag ${task.category.toLowerCase()}`}>{localize(language, task.category, task.category === 'Work' ? 'Trabaho' : task.category === 'Personal' ? 'Personal' : task.category === 'Errands' ? 'Mga lakad' : task.category)}</span><span className={`priority-tag ${getTaskPriority(task).toLowerCase()}`}><i />{localize(language, `${getTaskPriority(task)} priority`, getTaskPriority(task) === 'High' ? 'Mataas na prayoridad' : getTaskPriority(task) === 'Medium' ? 'Katamtamang prayoridad' : 'Mababang prayoridad')}</span>{task.mood && moodIcon && <span className="mood-tag"><Icon name={moodIcon} color={moodOptions.find(option => option.label === task.mood)?.color} size={12} />{localize(language, `Mood: ${task.mood}`, `Mood: ${task.mood === 'Great' ? 'Masaya' : task.mood === 'Good' ? 'Mabuti' : task.mood === 'Okay' ? 'Ayos lang' : task.mood === 'Low' ? 'Malungkot' : 'Stress'}`)}</span>}</div>{task.notes && <p className="task-notes"><strong>{localize(language, 'Notes', 'Mga tala')}</strong><span>{task.notes}</span></p>}</div>
  </article>;
}

function ToggleRow({ icon, label, checked, onChange, last = false }: { icon: IconName; label: string; checked: boolean; onChange: (value: boolean) => void; last?: boolean }) {
  return <div className={`toggle-row ${last ? 'last' : ''}`}><span className="toggle-label-icon"><Icon name={icon} size={16} /></span><span>{label}</span><button className={`switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={`${label} ${checked ? 'on' : 'off'}`} onClick={() => onChange(!checked)}><span /></button></div>;
}

function AddTaskSheet({ onClose, onSubmit, language }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; language: AppLanguage }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [category, setCategory] = useState('Personal');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [mood, setMood] = useState<Mood | ''>('');
  const [notes, setNotes] = useState('');
  const valid = title.trim().length > 0 && Boolean(date) && Boolean(time);
  return <div className="sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="add-sheet" role="dialog" aria-modal="true" aria-labelledby="add-task-title">
    <div className="sheet-handle" />
    <div className="sheet-heading"><div><p className="eyebrow">{localize(language, 'NEW TASK', 'BAGONG GAWAIN')}</p><h2 id="add-task-title">{localize(language, 'Add a task', 'Magdagdag ng gawain')}</h2></div><button className="icon-button" aria-label={localize(language, 'Close add task', 'Isara ang pagdagdag ng gawain')} onClick={onClose}><Icon name="close" /></button></div>
    <p className="sheet-intro">{localize(language, 'Small steps make a meaningful day.', 'Ang maliliit na hakbang ay nakabubuo ng makabuluhang araw.')}</p>
    <form onSubmit={onSubmit}>
      <label className="form-label" htmlFor="task-title">{localize(language, 'Task name', 'Pangalan ng gawain')}</label>
      <input id="task-title" name="title" value={title} onChange={event => setTitle(event.target.value)} placeholder={localize(language, 'What would you like to do?', 'Ano ang gusto mong gawin?')} required maxLength={100} autoFocus />
      <div className="form-grid">
        <div><label className="form-label" htmlFor="task-date">{localize(language, 'Date', 'Petsa')}</label><input id="task-date" name="date" type="date" value={date} onChange={event => setDate(event.target.value)} required /></div>
        <div><label className="form-label" htmlFor="task-time">{localize(language, 'Start time', 'Oras ng simula')}</label><input id="task-time" name="time" type="time" value={time} onChange={event => setTime(event.target.value)} required /></div>
      </div>
      <span className="form-label">{localize(language, 'Category', 'Kategorya')}</span>
      <div className="task-choice-row" role="radiogroup" aria-label={localize(language, 'Task category', 'Kategorya ng gawain')}>
        {taskCategories.map(option => <button key={option.label} type="button" role="radio" aria-checked={category === option.label} aria-label={`${localize(language, option.label, option.label === 'Work' ? 'Trabaho' : option.label === 'Personal' ? 'Personal' : 'Mga lakad')} ${localize(language, 'category', 'kategorya')}`} className={`task-choice ${category === option.label ? 'selected' : ''}`} onClick={() => setCategory(option.label)}><Icon name={option.icon} color={option.color} size={16} /><span>{localize(language, option.label, option.label === 'Work' ? 'Trabaho' : option.label === 'Personal' ? 'Personal' : 'Mga lakad')}</span></button>)}
      </div>
      <input type="hidden" name="category" value={category} />
      <span className="form-label">{localize(language, 'Priority', 'Prayoridad')}</span>
      <div className="task-choice-row" role="radiogroup" aria-label={localize(language, 'Task priority', 'Prayoridad ng gawain')}>
        {taskPriorities.map(option => <button key={option.label} type="button" role="radio" aria-checked={priority === option.label} aria-label={`${localize(language, option.label, option.label === 'Low' ? 'Mababa' : option.label === 'Medium' ? 'Katamtaman' : 'Mataas')} ${localize(language, 'priority', 'prayoridad')}`} className={`task-choice ${priority === option.label ? 'selected' : ''}`} onClick={() => setPriority(option.label)}><Icon name={option.icon} color={option.color} size={16} /><span>{localize(language, option.label, option.label === 'Low' ? 'Mababa' : option.label === 'Medium' ? 'Katamtaman' : 'Mataas')}</span></button>)}
      </div>
      <input type="hidden" name="priority" value={priority} />
      <span className="form-label">{localize(language, 'Mood (optional)', 'Mood (opsyonal)')}</span>
      <div className="mood-options" role="radiogroup" aria-label={localize(language, 'Task mood', 'Mood sa gawain')}>{moodOptions.map(option => <button key={option.label} type="button" role="radio" aria-checked={mood === option.label} aria-label={`${localize(language, option.label, option.label === 'Great' ? 'Masaya' : option.label === 'Good' ? 'Mabuti' : option.label === 'Okay' ? 'Ayos lang' : option.label === 'Low' ? 'Malungkot' : 'Stress')} mood`} className={`mood-button ${mood === option.label ? 'selected' : ''}`} onClick={() => setMood(mood === option.label ? '' : option.label)}><Icon name={option.icon} color={option.color} size={17} /><span>{localize(language, option.label, option.label === 'Great' ? 'Masaya' : option.label === 'Good' ? 'Mabuti' : option.label === 'Okay' ? 'Ayos lang' : option.label === 'Low' ? 'Malungkot' : 'Stress')}</span></button>)}</div>
      <input type="hidden" name="mood" value={mood} />
      <label className="form-label" htmlFor="task-notes">{localize(language, 'Notes (optional)', 'Mga tala (opsyonal)')}</label>
      <textarea id="task-notes" name="notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder={localize(language, 'Add a note for this task', 'Magdagdag ng tala sa gawain')} rows={3} />
      <div className="default-task-meta"><span><Icon name="clock" size={14} /> 30 {localize(language, 'min', 'min')}</span><span><Icon name="leaf" size={14} /> {localize(language, category, category === 'Work' ? 'Trabaho' : category === 'Personal' ? 'Personal' : 'Mga lakad')}</span><span><Icon name="target" size={14} /> {localize(language, priority, priority === 'Low' ? 'Mababa' : priority === 'Medium' ? 'Katamtaman' : 'Mataas')} {localize(language, 'priority', 'prayoridad')}</span></div>
      <div className="sheet-actions"><button type="button" className="cancel-button" onClick={onClose}>{localize(language, 'Cancel', 'Kanselahin')}</button><button className="submit-button" type="submit" disabled={!valid}><Icon name="plus" size={16} color="#2D7655" /> {localize(language, 'Add task', 'Magdagdag ng gawain')}</button></div>
    </form>
  </section></div>;
}

function TutorialOverlay({ bounds, step, neverAskAgain, onNeverAskAgain, onNext, onSkip }: {
  bounds: TutorialBounds;
  step: number;
  neverAskAgain: boolean;
  onNeverAskAgain: (value: boolean) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const current = tutorialSteps[step];
  return <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
    <div className="tutorial-highlight" style={{ left: bounds.left - 4, top: bounds.top - 4, width: bounds.width + 8, height: bounds.height + 8 }} />
    <span className="tutorial-arrow" style={{ left: bounds.left + bounds.width / 2 - 9, top: bounds.top - 29 }} aria-hidden="true"><Icon name="arrow-down" size={18} /></span>
    <section className="tutorial-card">
      <p className="eyebrow">QUICK TOUR · {step + 1} OF {tutorialSteps.length}</p>
      <h2 id="tutorial-title">{current.title}</h2>
      <p>{current.description}</p>
      <label className="tutorial-never"><input type="checkbox" checked={neverAskAgain} onChange={event => onNeverAskAgain(event.target.checked)} /> Never ask again</label>
      <div className="tutorial-actions"><button className="cancel-button" onClick={onSkip}>Skip</button><button className="submit-button" onClick={onNext}>{step === tutorialSteps.length - 1 ? 'Finish' : 'Next'}</button></div>
    </section>
  </div>;
}

function StartupSplash() {
  return <div className="startup-splash" role="status" aria-label="FlowTask">
    <span className="startup-logo"><Icon name="bolt" size={38} /></span>
    <strong>FlowTask</strong>
  </div>;
}

function Onboarding({ slide, setSlide, displayName, setDisplayName, onFinish }: { slide: number; setSlide: (value: number) => void; displayName: string; setDisplayName: (value: string) => void; onFinish: () => void }) {
  const last = slide === onboardingSlides.length;
  const current = onboardingSlides[Math.min(slide, onboardingSlides.length - 1)];
  function advance() {
    if (slide < onboardingSlides.length) setSlide(slide + 1);
    else onFinish();
  }
  return <div className="onboarding-screen"><div className="onboarding-top"><div className="brand-lockup"><div className="brand-mark"><Icon name="bolt" size={18} /></div><div className="brand-copy"><strong>FlowTask</strong><span>Make room for what matters</span></div></div><button onClick={onFinish}>Skip</button></div><div className="onboarding-body" key={slide}><div className={`onboard-art art-${slide}`}><span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" /><span className="art-center"><Icon name={last ? 'user' : current.icon} size={32} /></span>{slide === 1 && <span className="art-mini mini-one"><Icon name="check" size={15} /></span>}{slide === 1 && <span className="art-mini mini-two"><Icon name="calendar" size={15} /></span>}{slide === 2 && <span className="art-mini mini-one"><Icon name="sparkles" size={15} /></span>}{slide === 2 && <span className="art-mini mini-two"><Icon name="clock" size={15} /></span>}</div><p className="eyebrow">{last ? 'ONE LAST THING' : current.eyebrow}</p><h1>{last ? 'What should we call you?' : current.title}</h1><p>{last ? 'Your planner will use your name to make things feel a little more personal.' : current.body}</p>{last && <label className="onboarding-name"><Icon name="user" size={17} /><input autoFocus value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Your name" maxLength={32} aria-label="Enter your display name" onKeyDown={event => { if (event.key === 'Enter' && displayName.trim()) onFinish(); }} /></label>}</div><div className="onboarding-bottom"><div className="progress-dots" aria-label={`Step ${slide + 1} of 4`}>{onboardingSlides.map((_, index) => <span key={index} className={index === slide ? 'current' : index < slide ? 'passed' : ''} />)}<span className={slide === 3 ? 'current' : ''} /></div><button className="onboarding-next" onClick={advance} disabled={last && !displayName.trim()}>{last ? 'Get started' : 'Next'} <Icon name="arrow-right" size={17} /></button></div></div>;
}
