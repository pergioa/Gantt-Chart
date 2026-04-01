export interface Task{
    id:string,
    projectId:string,
    title:string,
    startDate:string,
    endDate:string,
    progress:number,
    parentId:string | null,
    order:number,
    createdAt:string
}

export interface CreateTask{
    title:string,
    startDate:string,
    endDate:string,
    progress:number,
    parentId:string | null,
    order:number
}

export interface UpdateTask{
    title:string,
    startDate:string,
    endDate:string,
    progress:number,
    parentId:string | null,
    order:number
}