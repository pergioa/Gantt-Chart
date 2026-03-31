using AutoMapper;
using GanttApp.Core.DTOs;
using GanttApp.Core.Entities;

namespace GanttApp.Infrastructure.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Project, ProjectDto>();
        CreateMap<CreateProjectDto, Project>();

        CreateMap<UpdateProjectDto, Project>()
                                            .ForMember(dest => dest.Id, opt => opt.Ignore())
                                            .ForMember(dest => dest.OwnerId, opt => opt.Ignore())
                                            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore());

        CreateMap<ProjectTask, TaskDto>();

        CreateMap<CreateTaskDto, ProjectTask>()
                                              .ForMember(dest => dest.Id, opt => opt.Ignore())
                                              .ForMember(dest => dest.ProjectId, opt => opt.Ignore())
                                              .ForMember(dest => dest.CreatedAt, opt => opt.Ignore());
        CreateMap<UpdateTaskDto, ProjectTask>()
                                              .ForMember(dest => dest.Id, opt => opt.Ignore())
                                              .ForMember(dest => dest.ProjectId, opt => opt.Ignore())
                                              .ForMember(dest => dest.CreatedAt, opt => opt.Ignore());
    }
}