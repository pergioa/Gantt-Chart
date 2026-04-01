using FluentValidation;
using GanttApp.Core.DTOs;

namespace GanttApp.API.Validators;

public class CreateProjectDtoValidator : AbstractValidator<CreateProjectDto>
{
    public CreateProjectDtoValidator()
    {
        RuleFor(p => p.Name).NotEmpty().MaximumLength(512);
        RuleFor(p => p.OwnerId).NotEqual(Guid.Empty);
    }
}