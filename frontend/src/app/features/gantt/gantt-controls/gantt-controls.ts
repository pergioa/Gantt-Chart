import { Component, EventEmitter, Output } from '@angular/core';

export type ViewMode = 'Day' | 'Week' | 'Month';

@Component({
  selector: 'app-gantt-controls',
  imports: [],
  templateUrl: './gantt-controls.html',
  styleUrl: './gantt-controls.scss',
})
export class GanttControls {
  @Output() viewModeChanged = new EventEmitter<ViewMode>();
  @Output() addTask = new EventEmitter<void>();

  activeMode: ViewMode = 'Day';

  setViewMode(mode: ViewMode): void {
    this.activeMode = mode;
    this.viewModeChanged.emit(mode);
  }
}
