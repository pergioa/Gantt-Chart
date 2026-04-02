export interface Project{
    id:string,
    name:string,
    description:string,
    ownerId:string,
    createdAt:string
}

export interface CreateProject{
    name:string,
    description:string
}

export interface UpdateProject{
    name:string,
    description:string
}