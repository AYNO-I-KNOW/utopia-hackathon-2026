import { h } from '../dom.js';
import { t, label, activityLabel, weekdays, fullDate, CLASSES } from '../i18n.js';
import { getActivities, dateKey, currentTime } from '../activities.js';
import { langToggle } from '../ui.js';

const DAYS_IN_WEEK = 7;
const NOON_MORNING_END = 12;
const AFTERNOON_END = 18;

function greetingKey() {
  const hour = Number(currentTime().slice(0, 2));
  if (hour < NOON_MORNING_END) return 'greet_morning';
  return hour < AFTERNOON_END ? 'greet_afternoon' : 'greet_evening';
}

// Noon Bangkok = 05:00Z, so UTC getters give the Bangkok calendar day regardless of device timezone.
function weekDates(selectedDate) {
  const selected = new Date(`${selectedDate}T12:00:00+07:00`);
  const start = new Date(selected);
  start.setUTCDate(selected.getUTCDate() - selected.getUTCDay());
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return day;
  });
}

function weekStrip(app) {
  const names = weekdays();
  const buttons = weekDates(app.state.selectedDate).map((day) => {
    const key = dateKey(day);
    const selected = key === app.state.selectedDate;
    return h('button', {
      type: 'button',
      class: selected ? 'primary' : '',
      'aria-label': fullDate(day),
      'aria-current': selected ? 'date' : null,
      onclick: () => { app.state.selectedDate = key; app.rerender(); },
    }, h('small', null, names[day.getUTCDay()]), h('b', null, day.getUTCDate()));
  });
  return h('div', { class: 'week' }, ...buttons);
}

function activityCard(entry) {
  const range = entry.from === entry.to ? entry.from : `${entry.from} – ${entry.to}`;
  const children = [h('h2', null, activityLabel(entry.activity)), h('p', null, range + t('time_suffix'))];
  if (entry.note) children.push(h('p', null, entry.note));
  if (CLASSES.includes(entry.reason)) {
    const confidence = Number.isFinite(entry.confidence) ? ` (${entry.confidence}%)` : '';
    children.push(h('p', { class: 'note' }, t('tl_reason', { x: label(entry.reason) }) + confidence));
  }
  return h('article', { class: 'card activity-card' }, ...children);
}

function activityList(selectedDate) {
  const items = getActivities()
    .filter((entry) => entry.date === selectedDate)
    .sort((a, b) => String(a.from).localeCompare(String(b.from)) || a.id - b.id);
  const children = items.length ? items.map(activityCard) : [h('p', { class: 'center' }, t('tl_empty'))];
  return h('div', { class: 'activity-list' }, ...children);
}

export default {
  title: 'nav_home',
  header: false,
  nav: true,
  contentClass: 'timeline-content',
  render(app) {
    // The Bangkok day may have rolled over since the last visit.
    const today = dateKey(new Date());
    if (today !== app.state.today) {
      app.state.today = today;
      app.state.selectedDate = today;
    }
    const greeting = h('div', { class: 'greeting' },
      h('div', { class: 'profile-circle', 'aria-hidden': 'true' }),
      h('div', null, h('h2', null, t(greetingKey())), h('p', null, t('greet_sub'))),
      langToggle(app.setLang));
    app.content.append(
      h('div', { class: 'calendar-top' }, greeting, weekStrip(app), h('div', { class: 'calendar-handle' })),
      h('div', { class: 'activities-heading' },
        h('h2', null, t('tl_activities')),
        h('button', { type: 'button', 'aria-label': t('add_activity'), onclick: () => app.beginActivity('timeline') }, '+')),
      activityList(app.state.selectedDate));
  },
};
