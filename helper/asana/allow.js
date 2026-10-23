/* ============================================================
   ASANA ALLOWLIST — the only code that decides what of Asana the helper keeps.

   Everything read from Asana passes through one of these functions, and each
   returns a NEW object holding allowlisted keys only (D49, D68, D71). Custom
   fields are matched by exact name (emoji included) against KEPT_FIELDS;
   anything not on that list is dropped, so client names, GCI, contract price,
   source of business, notes, comment text and people's private details can
   never reach a recording, a report or the database.

     keepTask(raw, projectGid?)  → { gid, name, completed, completedAt, dueOn,
                                     modifiedAt, createdAt, assignee, section,
                                     projectGid, parentGid, permalink, fields }
     keepSubtask(raw)            → the same without fields, section or project
     keepStory(raw)              → { type, at, from, to } | null  (comments etc. → null)
     keepPerson(raw)             → { gid, name, section, title, state, team,
                                     deBioUrl, deProfileUrl, past }
     keepLoose(raw, projectGid?) → { gid, name, projectGid, dueOn, completedAt, assignee }
     keepPost(raw, projectGid?)  → { gid, name, completed, completedAt, dueOn, section,
                                     projectGid, tags, format, stage, link }   (💬 Social Media)
     (projectGid: the project being read, used when Asana sent no memberships)
     missingKept(tasks)          → kept field names no task has at all (a renamed field)
     KEPT_FIELDS, TASK_FIELDS    the names kept; the opt_fields string asked for
     POST_FIELDS                 the opt_fields string for the social posts project

   A kept field a task has but left empty is present as null; one the task
   doesn't have is absent. That difference is how a rename is noticed.
   ============================================================ */
'use strict';

const KEPT_FIELDS = [
  'Listing Status', 'Sale/Rent', 'Deal Side',
  '🗓️ Pitch', '🗓️ Exclusive Date', '🗓️ Est. Listing Date', '🗓️ Listing Date', '🗓️ AO Date', '🗓️ CS Date',
  '🗓️ BPS Date', '🗓️ BI Date', '🗓️ BA Date', '🗓️ CC Date', '🗓️ Closing Date', '🗓️ Exclusive Expires',
  '📍 State', '📍 County', '📍 City/Hood', '📍 Zip', '📍 MLS',
  '💵 Original Price', '💵 Current Price',
  'ℹ️ Property Type', 'ℹ️ Property Stats', 'ℹ️ INT SF', 'ℹ️ Acreage',
  '🛜 Elliman Link', '🛜 Google Drive Link', 'Google Maps Link', '🧑‍💼 Point Person', 'Listing Copy'
];

/* the survey saw the zip field called "Zip Code"; it is kept under one name */
const ALIASES = { '📍 Zip Code': '📍 Zip' };

const TASK_FIELDS = [
  'name', 'completed', 'completed_at', 'due_on', 'modified_at', 'created_at', 'assignee.name',
  'memberships.section.name', 'memberships.project.gid', 'parent.gid',
  'custom_fields.name', 'custom_fields.display_value', 'custom_fields.number_value',
  'custom_fields.date_value', 'custom_fields.enum_value.name', 'custom_fields.multi_enum_values.name',
  'permalink_url'
].join(',');

const STORY_FIELDS = [
  'resource_subtype', 'created_at', 'custom_field.name', 'old_enum_value.name', 'new_enum_value.name',
  'old_dates', 'new_dates', 'old_section.name', 'new_section.name'
].join(',');

/* the value of one custom field, however Asana typed it; null when empty */
function valueOf(cf) {
  if (Array.isArray(cf.multi_enum_values) && cf.multi_enum_values.length) return cf.multi_enum_values.map(v => v.name);
  if (cf.enum_value && cf.enum_value.name) return cf.enum_value.name;
  if (cf.number_value !== null && cf.number_value !== undefined) return cf.number_value;
  if (cf.date_value && (cf.date_value.date || cf.date_value.start_on)) return cf.date_value.date || cf.date_value.start_on;
  if (cf.display_value !== null && cf.display_value !== undefined && cf.display_value !== '') return cf.display_value;
  return null;
}

/* Asana field names sometimes carry a double space after the icon ("ℹ️  Acreage"),
   so names are compared with runs of spaces collapsed. */
const spaced = s => String(s || '').replace(/\s+/g, ' ').trim();

function keptFields(raw) {
  const out = {};
  (raw.custom_fields || []).forEach(cf => {
    const name = ALIASES[spaced(cf.name)] || spaced(cf.name);
    if (KEPT_FIELDS.indexOf(name) !== -1) out[name] = valueOf(cf);
  });
  return out;
}

const nm = o => (o && o.name) || null;
const gidOf = o => (o && o.gid) || null;

function membership(raw, projectGid) {
  const ms = raw.memberships || [];
  return ms.find(m => projectGid && m.project && m.project.gid === projectGid) || ms[0] || {};
}

function keepTask(raw, projectGid) {
  const m = membership(raw, projectGid);
  return {
    gid: raw.gid,
    name: raw.name,
    completed: !!raw.completed,
    completedAt: raw.completed_at || null,
    dueOn: raw.due_on || null,
    modifiedAt: raw.modified_at || null,
    createdAt: raw.created_at || null,
    assignee: nm(raw.assignee),
    section: nm(m.section),
    projectGid: gidOf(m.project) || projectGid || null,
    parentGid: gidOf(raw.parent),
    permalink: raw.permalink_url || null,
    fields: keptFields(raw)
  };
}

function keepSubtask(raw) {
  return {
    gid: raw.gid,
    name: raw.name,
    completed: !!raw.completed,
    completedAt: raw.completed_at || null,
    dueOn: raw.due_on || null,
    assignee: nm(raw.assignee),
    parentGid: gidOf(raw.parent)
  };
}

function keepStory(raw) {
  const at = raw.created_at || null;
  const story = (type, from, to) => ({ type, at, from: from === undefined ? null : from, to: to === undefined ? null : to });
  switch (raw.resource_subtype) {
    case 'enum_custom_field_changed':
      return raw.custom_field && raw.custom_field.name === 'Listing Status'
        ? story('status', nm(raw.old_enum_value), nm(raw.new_enum_value)) : null;
    case 'section_changed': return story('section', nm(raw.old_section), nm(raw.new_section));
    case 'due_date_changed': return story('due', raw.old_dates && raw.old_dates.due_on, raw.new_dates && raw.new_dates.due_on);
    case 'marked_complete': return story('complete');
    case 'marked_incomplete': return story('incomplete');
    default: return null;
  }
}

/* People: the few safe fields of the 👋 People project, by exact name. Phone,
   email, licence, birthday, address and the free-text "Agent Title" are never read. */
function keepPerson(raw) {
  const by = {};
  (raw.custom_fields || []).forEach(cf => { by[spaced(cf.name)] = valueOf(cf); });
  const section = nm(((raw.memberships || [])[0] || {}).section);
  const team = by['GVC Internal Team'];
  return {
    gid: raw.gid,
    name: raw.name,
    section,
    title: by['Title'] || null,
    state: by['📍 State'] || null,
    team: Array.isArray(team) ? team : (team ? [team] : []),
    deBioUrl: by['DE Bio'] || null,
    deProfileUrl: by['Douglas Elliman'] || null,
    past: section === 'Past Team Members'
  };
}

function keepLoose(raw, projectGid) {
  const m = (raw.memberships || [])[0] || {};
  return {
    gid: raw.gid,
    name: raw.name,
    projectGid: gidOf(m.project) || projectGid || null,
    dueOn: raw.due_on || null,
    completedAt: raw.completed_at || null,
    assignee: nm(raw.assignee)
  };
}

/* Social posts (💬 Social Media): only what a job's post count needs. The listing
   each post is for (any "🏡 <year> Properties" tag), its format and production stage,
   and the public post link (https only). Engagement figures, hooks, vendors, shoot
   dates, estimates and notes are never read. */
const POST_FIELDS = [
  'name', 'completed', 'completed_at', 'due_on', 'memberships.section.name', 'memberships.project.gid',
  'custom_fields.name', 'custom_fields.display_value', 'custom_fields.enum_value.name', 'custom_fields.multi_enum_values.name'
].join(',');
const PROPERTY_TAG = /^🏡\s*\d{4} Properties$/;

function keepPost(raw, projectGid) {
  const m = membership(raw, projectGid);
  const out = { gid: raw.gid, name: raw.name, completed: !!raw.completed, completedAt: raw.completed_at || null,
    dueOn: raw.due_on || null, section: nm(m.section), projectGid: gidOf(m.project) || projectGid || null,
    tags: [], format: null, stage: null, link: null };
  (raw.custom_fields || []).forEach(cf => {
    const name = spaced(cf.name), v = valueOf(cf);
    if (PROPERTY_TAG.test(name) && v !== null) out.tags = out.tags.concat(Array.isArray(v) ? v : [String(v)]);
    else if (name === 'Post Format' && typeof v === 'string') out.format = v;
    else if (name === 'Production Stage' && typeof v === 'string') out.stage = v;
    else if (name === 'Post Link' && typeof v === 'string' && /^https:\/\/\S+$/.test(v.trim())) out.link = v.trim();
  });
  return out;
}

function missingKept(tasks) {
  if (!tasks || !tasks.length) return [];
  return KEPT_FIELDS.filter(n => !tasks.some(t => t.fields && n in t.fields));
}

module.exports = { keepTask, keepSubtask, keepStory, keepPerson, keepLoose, keepPost, missingKept, KEPT_FIELDS, TASK_FIELDS, STORY_FIELDS, POST_FIELDS };
