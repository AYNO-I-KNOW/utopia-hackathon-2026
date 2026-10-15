import { h } from '../dom.js';
import { t, activityLabel, ACTIVITY_TYPES } from '../i18n.js';
import { addActivity, prepareEntry } from '../activities.js';
import { dialog } from '../ui.js';

const FORM_ID = 'activity-form';

function commit(event, app) {
  event.preventDefault();
  const form = new FormData(event.target);
  const { draft } = app.state;
  const entry = {
    id: Date.now(),
    activity: form.get('activity'),
    date: form.get('date'),
    from: form.get('from'),
    to: form.get('to'),
    note: String(form.get('note')).trim(),
    reason: draft?.reason ?? null,
    confidence: draft?.confidence ?? null,
  };
  const prepared = prepareEntry(entry);
  if (prepared.error) return failDialog(t(`save_time_${prepared.error}`));
  if (!addActivity(prepared.entry)) return failDialog(t('save_fail'));
  if (draft) app.state.saved = true;
  app.state.draft = null;
  app.state.selectedDate = prepared.entry.date;
  app.go('timeline');
}

function failDialog(body) {
  dialog({ title: t('save_fail_title'), body, actions: [{ label: t('ok'), primary: true }] });
}

const field = (labelText, control) => h('label', null, labelText, control);

export default {
  title: 'title_activity',
  render(app) {
    const { selectedDate, draftTime, draft } = app.state;
    const options = ACTIVITY_TYPES.map((type) =>
      h('option', { value: type, selected: draft?.type === type }, activityLabel(type)));
    app.content.append(h('form', { id: FORM_ID, class: 'activity-form', onsubmit: (event) => commit(event, app) },
      field(t('f_activity'), h('select', { name: 'activity' }, ...options)),
      field(t('f_date'), h('input', { name: 'date', type: 'date', value: selectedDate, required: true })),
      h('div', { class: 'time-fields' },
        field(t('f_from'), h('input', { name: 'from', type: 'time', value: draftTime, required: true })),
        field(t('f_to'), h('input', { name: 'to', type: 'time', value: draftTime, required: true }))),
      field(t('f_note'), h('textarea', { name: 'note', rows: '3', placeholder: t('f_note_ph') }))));
    app.footer.append(h('button', { class: 'primary', type: 'submit', form: FORM_ID }, t('save')));
  },
  back(app) {
    const { activityFrom, saved } = app.state;
    app.go(activityFrom === 'result' && !saved ? 'result' : 'timeline');
  },
};
