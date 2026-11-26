// The live project store: saved to localStorage on every change, with undo.
// The model itself (types, defaults, migration) lives in project.ts.
import { migrate, type Project } from './project';

export * from './project';

const STORAGE_KEY = 'octo.project.v2';
/** Saves from before integer ticks; read once, then saved under the new key. */
const OLD_STORAGE_KEY = 'octo.project.v1';

function load(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
    const old = localStorage.getItem(OLD_STORAGE_KEY);
    if (old) {
      const p = migrate(JSON.parse(old));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
      return p;
    }
  } catch {
    /* fall through to default */
  }
  return migrate(null);
}

export const project: Project = load();

type Listener = () => void;
const listeners = new Set<Listener>();
let saveTimer = 0;

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const serialize = () => JSON.stringify(project, (k, v) => (k === 'skipAbs' ? undefined : v));

// Undo history: snapshots of the whole project. Changes closer together than
// UNDO_GAP ms (a knob drag, a burst of taps) count as one step. Changes made
// with a group name (one loop pass of recording) count as one step however
// long they take, and a new group always starts a new step.
const UNDO_GAP = 700;
const undoStack: string[] = [];
const redoStack: string[] = [];
let snapshot = serialize();
let lastChange = 0;
let lastGroup: string | undefined;

function changed() {
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 300);
}

/** Mutate the project, then notify and save. */
export function update(fn: (p: Project) => void, group?: string) {
  const now = performance.now();
  const sameStep = group !== undefined ? group === lastGroup : lastGroup === undefined && now - lastChange <= UNDO_GAP;
  if (!sameStep) {
    undoStack.push(snapshot);
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
  }
  lastChange = now;
  lastGroup = group;
  fn(project);
  snapshot = serialize();
  changed();
}

function restore(json: string) {
  const data = JSON.parse(json) as Project;
  for (const k of Object.keys(project)) delete (project as unknown as Record<string, unknown>)[k];
  Object.assign(project, data);
  snapshot = json;
  lastChange = 0;
  lastGroup = undefined;
  changed();
}

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

export function undo() {
  const prev = undoStack.pop();
  if (prev === undefined) return;
  redoStack.push(snapshot);
  restore(prev);
}

export function redo() {
  const next = redoStack.pop();
  if (next === undefined) return;
  undoStack.push(snapshot);
  restore(next);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, serialize());
  } catch {
    /* storage unavailable: keep working in memory */
  }
}
