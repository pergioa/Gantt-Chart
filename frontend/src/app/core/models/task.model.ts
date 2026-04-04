export type DependencyType = 'FinishToStart' | 'StartToStart' | 'FinishToFinish';

export interface TaskDependencyItem {
    predecessorId: string;
    type: DependencyType;
}

export interface Task{
    id:string,
    projectId:string,
    title:string,
    startDate:string,
    endDate:string,
    progress:number,
    parentId:string | null,
    order:number,
    createdAt:string,
    dependencies:TaskDependencyItem[]
}

export interface CreateTask{
    title:string,
    startDate:string,
    endDate:string,
    progress:number,
    parentId:string | null,
    order:number,
    dependencies:TaskDependencyItem[]
}

export interface UpdateTask{
    title:string,
    startDate:string,
    endDate:string,
    progress:number,
    parentId:string | null,
    order:number,
    dependencies:TaskDependencyItem[]
}

export interface DragUpdateTask {
    startDate: string;
    endDate: string;
    progress: number;
}