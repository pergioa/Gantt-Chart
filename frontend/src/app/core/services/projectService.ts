import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable, catchError } from 'rxjs';
import { CreateProject, Project, UpdateProject } from '../models/project.model';
import { CreateTask, Task } from '../models/task.model';
import { handleError } from './handle-error';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly httpClient = inject(HttpClient);
  private readonly apiUrl:string = environment.apiUrl;

  public getAll():Observable<Project[]>{
    return this.httpClient.get<Project[]>(this.apiUrl + '/projects').pipe(catchError(handleError('getAll')));
  }

  public getById(id:string):Observable<Project>{
    return this.httpClient.get<Project>(this.apiUrl + `/projects/${id}`).pipe(catchError(handleError('getById')));
  }

  public create(dto: CreateProject):Observable<Project>{
    return this.httpClient.post<Project>(this.apiUrl + '/projects', dto).pipe(catchError(handleError('create')));
  }

  public update(id:string, dto:UpdateProject):Observable<Project>{
    return this.httpClient.put<Project>(this.apiUrl + `/projects/${id}`,dto).pipe(catchError(handleError('update')));
  }

  public delete(id:string):Observable<void>{
    return this.httpClient.delete<void>(this.apiUrl + `/projects/${id}`).pipe(catchError(handleError('delete')));
  }

  public getTasks(projectId: string): Observable<Task[]> {
    return this.httpClient.get<Task[]>(this.apiUrl + `/projects/${projectId}/tasks`).pipe(catchError(handleError('getTasks')));
  }

  public createTask(projectId: string, dto: CreateTask): Observable<Task> {
    return this.httpClient.post<Task>(this.apiUrl + `/projects/${projectId}/tasks`, dto).pipe(catchError(handleError('createTask')));
  }
}
