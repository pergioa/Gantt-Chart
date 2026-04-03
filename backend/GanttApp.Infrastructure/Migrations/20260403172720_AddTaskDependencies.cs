using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GanttApp.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskDependencies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TaskDependencies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    PredecessorId = table.Column<Guid>(type: "uuid", nullable: false),
                    SuccessorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskDependencies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskDependencies_ProjectTasks_PredecessorId",
                        column: x => x.PredecessorId,
                        principalTable: "ProjectTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TaskDependencies_ProjectTasks_SuccessorId",
                        column: x => x.SuccessorId,
                        principalTable: "ProjectTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaskDependencies_PredecessorId",
                table: "TaskDependencies",
                column: "PredecessorId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskDependencies_SuccessorId",
                table: "TaskDependencies",
                column: "SuccessorId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TaskDependencies");
        }
    }
}
