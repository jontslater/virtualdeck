import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', '..', 'backend_data');
const PROCESSED_EVENTS = path.join(DATA_DIR, 'processed_events.json');

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // ignore
  }
}

export async function loadProcessedEventIds(): Promise<Set<string>> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(PROCESSED_EVENTS, 'utf-8');
    const arr: string[] = JSON.parse(raw);
    return new Set(arr);
  } catch (err) {
    return new Set();
  }
}

export async function appendProcessedEventId(id: string): Promise<void> {
  await ensureDataDir();
  try {
    const set = await loadProcessedEventIds();
    set.add(id);
    const arr = Array.from(set);
    await fs.writeFile(PROCESSED_EVENTS, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (err) {
    // best-effort; ignore
  }
}

