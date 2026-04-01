using FluentValidation;
using GanttApp.Core.DTOs;

namespace GanttApp.API.Validators;

public class CreateTaskDtoValidator : AbstractValidator<CreateTaskDto>
{
    public CreateTaskDtoValidator()
    {
        RuleFor(t => t.Title)
                            .NotEmpty()
                            .MaximumLength(512);

        RuleFor(t => t.StartDate).NotEmpty();
        RuleFor(t => t.EndDate)
                              .NotEmpty()
                              .GreaterThan(t => t.EndDate)
                              .WithMessage("EndDate must be greater than StartDate");
        
        RuleFor(t => t.Progress).InclusiveBetween(0, 100);
    }
}