export type TaskAssistantTask = {
  title: string;
  date: string;
  time: string;
  duration: number;
  category: string;
  priority?: 'Low' | 'Medium' | 'High';
  energy?: 'Low' | 'Medium' | 'High';
  completed: boolean;
  mood?: string;
};

function priorityRank(task: TaskAssistantTask) {
  const priority = task.priority ?? task.energy ?? 'Medium';
  return priority === 'High' ? 2 : priority === 'Medium' ? 1 : 0;
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function getTaskAssistantReply(question: string, tasks: TaskAssistantTask[], now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayTasks = tasks.filter(task => task.date === today);
  const unfinishedToday = todayTasks
    .filter(task => !task.completed)
    .sort((a, b) => priorityRank(b) - priorityRank(a) || a.time.localeCompare(b.time));
  const tagalog = /\b(anong|ano|magandang|gawin|ngayong|trabaho|unahin|pagod|pahinga|tulong|kailangan)\b/i.test(question);
  const asksForWork = /\b(work|trabaho|office|project)\b/i.test(question);
  const feelsLowEnergy = /\b(pagod|tired|overwhelm|stressed|burned out|burnt out|low energy)\b/i.test(question);

  if (unfinishedToday.length === 0) {
    const upcoming = tasks
      .filter(task => !task.completed && task.date > today)
      .sort((a, b) => a.date.localeCompare(b.date) || priorityRank(b) - priorityRank(a) || a.time.localeCompare(b.time))[0];
    if (todayTasks.length > 0) {
      return tagalog
        ? `Tapos mo na ang lahat ng ${todayTasks.length} task ngayong araw. Magpahinga muna, o balikan ang susunod mong plano bukas.`
        : `You’ve finished all ${todayTasks.length} tasks for today. Take a proper break, or look ahead to your next planned task.`;
    }
    if (upcoming) {
      return tagalog
        ? `Wala kang task na naka-iskedyul ngayong araw. Ang pinakamalapit mong plano ay “${upcoming.title}” sa ${formatDate(upcoming.date)} ng ${upcoming.time}. Magdagdag ng task kung may kailangan kang tapusin ngayon.`
        : `You don’t have any tasks scheduled for today. Your next planned task is “${upcoming.title}” on ${formatDate(upcoming.date)} at ${upcoming.time}. Add a task if there’s something you need to get done today.`;
    }
    return tagalog
      ? 'Wala kang naka-iskedyul na task ngayon o sa mga susunod na araw. Magdagdag ng task para makapagrekomenda ako batay sa mga plano mo.'
      : 'You don’t have any tasks scheduled today or coming up. Add a task and I can make recommendations from your plans.';
  }

  const workTasks = unfinishedToday.filter(task => task.category.trim().toLowerCase() === 'work');
  const upcomingToday = unfinishedToday.filter(task => task.time >= currentTime);
  const upcomingWork = workTasks.filter(task => task.time >= currentTime);
  const focusTasks = asksForWork
    ? upcomingWork.length > 0 ? upcomingWork : workTasks.length > 0 ? workTasks : upcomingToday
    : upcomingToday.length > 0 ? upcomingToday : unfinishedToday;
  const rankedTasks = focusTasks.slice().sort((a, b) => {
    if (feelsLowEnergy) return a.duration - b.duration || priorityRank(b) - priorityRank(a) || a.time.localeCompare(b.time);
    return priorityRank(b) - priorityRank(a) || a.time.localeCompare(b.time);
  });
  const first = rankedTasks[0];
  const second = rankedTasks
    .filter(task => task !== first && task.time >= currentTime && task.time >= first.time)
    .sort((a, b) => a.time.localeCompare(b.time))[0];
  const doneCount = todayTasks.filter(task => task.completed).length;
  const target = asksForWork && workTasks.length > 0 ? 'work' : first.category.toLowerCase();
  const nextStep = second
    ? tagalog ? ` Pagkatapos, gawin ang “${second.title}” sa ${second.time}.` : ` Then move on to “${second.title}” at ${second.time}.`
    : '';
  const firstStep = first.time < currentTime
    ? tagalog ? `“${first.title}” ang naka-iskedyul noong ${first.time}, kaya isingit ito sa susunod mong bakanteng oras.` : `“${first.title}” was scheduled for ${first.time}, so move it to your next free slot.`
    : tagalog ? `simulan sa “${first.title}” ng ${first.time}.` : `start with “${first.title}” at ${first.time}.`;
  const rest = feelsLowEnergy
    ? tagalog ? ' Simulan sa maliit na hakbang, tapos magpahinga sandali.' : ' Start with this manageable step, then take a short reset.'
    : tagalog ? ' Maglaan din ng kaunting pahinga sa pagitan ng mga task.' : ' Leave a little breathing room between tasks.';

  return tagalog
    ? `Base sa tasks mo ngayong araw (${doneCount}/${todayTasks.length} tapos), unahin: ${firstStep} Ito ang ${first.priority ?? first.energy ?? 'Medium'}-priority mong ${target} task.${nextStep}${rest}`
    : `Based on today’s tasks (${doneCount}/${todayTasks.length} complete), ${firstStep} It’s your highest-priority ${target} task.${nextStep}${rest}`;
}
