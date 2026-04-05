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
      start: this.toDateOnlyString(dto.startDate),
      end: this.toDateOnlyString(dto.endDate),
      progress: dto.progress,
      dependencies: dto.dependencies.map((d) => d.predecessorId).join(','),
      dependencyItems: dto.dependencies,
    };
  }

  public fromFrappeTask(ft: FrappeTask, start: Date, end: Date): DragUpdateTask {
    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end),
      progress: ft.progress,
    };
  }

  private toDateOnlyString(value: string): string {
    return value.includes('T') ? value.split('T')[0] : value;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
