import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Task, TaskDependencyItem, UpdateTask } from '../models/task.model';
import { handleError } from './handle-error';

export interface BatchTaskPayload {
  id: string;
  parentId: string | null;
  title: string;
  startDate: string;
  endDate: string;
  order: number;
  progress: number;
  dependencies: TaskDependencyItem[];
}

export interface BatchUpdatePayload {
  tasks: BatchTaskPayload[];
}

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiUrl: string = environment.apiUrl;

  public update(id: string, dto: UpdateTask): Observable<Task> {
    return this.httpClient
      .put<Task>(this.apiUrl + `/tasks/${id}`, dto)
      .pipe(catchError(handleError('update')));
  }

  public delete(id: string): Observable<void> {
    return this.httpClient
      .delete<void>(this.apiUrl + `/tasks/${id}`)
      .pipe(catchError(handleError('delete')));
  }

  public batchUpdate(projectId: string, payload: BatchUpdatePayload): Observable<Task[]> {
    return this.httpClient
      .patch<Task[]>(this.apiUrl + `/projects/${projectId}/tasks/batch`, payload)
      .pipe(catchError(handleError('batchUpdate')));
  }
}
