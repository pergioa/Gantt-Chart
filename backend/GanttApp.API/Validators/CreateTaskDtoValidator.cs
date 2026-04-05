using FluentValidation;
using GanttApp.Core.DTOs;

namespace GanttApp.API.Validators;

public class CreateTaskDtoValidator : AbstractValidator<CreateTaskDto>
{
    public CreateTaskDtoValidator()
    {
        RuleFor(t => t.Title).NotEmpty().MaximumLength(512);

        RuleFor(t => t.StartDate).NotEmpty();
        RuleFor(t => t.EndDate)
            .NotEmpty()
            .GreaterThanOrEqualTo(t => t.StartDate)
            .WithMessage("EndDate must be greater than or equal to StartDate");

        RuleFor(t => t.Progress).InclusiveBetween(0, 100);
    }
}
