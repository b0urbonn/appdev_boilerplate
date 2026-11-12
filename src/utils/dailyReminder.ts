import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_KEY = 'flowtask-daily-task-reminder';

function assertAndroid() {
  if (Platform.OS !== 'android') {
    throw new Error('Daily reminders are available in the Android app.');
  }
}

function parseTime(time: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new Error('Choose a valid reminder time.');
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

async function getReminderIds() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled
    .filter(notification => notification.content.data?.reminderKey === REMINDER_KEY)
    .map(notification => notification.identifier);
}

export async function cancelDailyTaskReminder() {
  assertAndroid();
  const identifiers = await getReminderIds();
  await Promise.all(identifiers.map(identifier =>
    Notifications.cancelScheduledNotificationAsync(identifier)
  ));
}

export async function scheduleDailyTaskReminder(time: string) {
  assertAndroid();
  const { hour, minute } = parseTime(time);
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Allow notifications in Android settings to enable daily reminders.');
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Daily reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await cancelDailyTaskReminder();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'A moment for your plans',
      body: 'Take a moment to review today’s tasks and choose your next step.',
      data: { reminderKey: REMINDER_KEY },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: 'default',
    },
  });
}
