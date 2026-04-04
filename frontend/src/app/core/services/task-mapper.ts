import { Injectable } from '@angular/core';
import { DragUpdateTask, Task } from '../models/task.model';
import { FrappeTask } from '../models/frappe-task.model';

@Injectable({
  providedIn: 'root',
})
export class TaskMapper {
  public toFrappeTask(dto: Task): FrappeTask {
    return {
      id: dto.id,
      name: dto.title,
      start: dto.startDate.split('T')[0],
      end: dto.endDate.split('T')[0],
      progress: dto.progress,
      dependencies: dto.dependencies.join(','),
    };
  }

  public fromFrappeTask(ft: FrappeTask, start: Date, end: Date): DragUpdateTask {
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      progress: ft.progress,
    };
  }
}
