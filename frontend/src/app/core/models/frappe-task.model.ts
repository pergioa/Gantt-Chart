export interface FrappeTask {
  id: string,
  name: string,
  start: string,       // 'yyyy-MM-dd'
  end: string,       // 'yyyy-MM-dd'
  progress: number,    // 0–100
  dependencies: string, // comma-separated predecessor IDs e.g. "task-1,task-2"
  custom_class?: string,
}
