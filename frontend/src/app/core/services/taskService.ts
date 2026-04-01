import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateTask, Task, UpdateTask } from '../models/task.model';
import { handleError } from './handle-error';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiUrl: string = environment.apiUrl;

  public getByProject(projectId: string): Observable<Task[]> {
    return this.httpClient
      .get<Task[]>(this.apiUrl + `/projects/${projectId}/tasks`)
      .pipe(catchError(handleError('getByProject')));
  }

  public create(projectId: string, dto: CreateTask): Observable<Task> {
    return this.httpClient
      .post<Task>(this.apiUrl + `/projects/${projectId}/tasks`, dto)
      .pipe(catchError(handleError('create')));
  }

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
}
