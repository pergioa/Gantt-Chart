import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FrappeTask } from '../../../core/models/frappe-task.model';
import { ViewMode } from '../gantt-controls/gantt-controls';

declare const Gantt: any;

@Component({
  selector: 'app-gantt-wrapper',
  imports: [],
  templateUrl: './gantt-wrapper.html',
  styleUrl: './gantt-wrapper.scss',
})
export class GanttWrapper implements AfterViewInit, OnChanges, OnDestroy {
  @Input() tasks: FrappeTask[] = [];
  @Output() dateChanged = new EventEmitter<{ task: FrappeTask; start: Date; end: Date }>();
  @Output() progressChanged = new EventEmitter<{ task: FrappeTask; progress: number }>();
  @Output() taskClicked = new EventEmitter<FrappeTask>();

  @ViewChild('ganttContainer') container!: ElementRef;
  @ViewChild('popupHost') popupHost!: ElementRef<HTMLDivElement>;

  private gantt: any = null;
  private currentViewMode: ViewMode = 'Day';
  private viewInitialized = false;
  private resizeObserver: ResizeObserver | null = null;
  private layoutFrameId: number | null = null;
  private layoutTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.observeContainerResize();
    this.renderGantt();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks'] && this.viewInitialized) {
      this.renderGantt();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.layoutFrameId !== null) {
      cancelAnimationFrame(this.layoutFrameId);
    }
    if (this.layoutTimeoutId !== null) {
      clearTimeout(this.layoutTimeoutId);
    }
    this.clearPopupHost();
    this.gantt = null;
  }

  setViewMode(mode: ViewMode): void {
    this.currentViewMode = mode;

    if (this.gantt) {
      this.gantt.change_view_mode(mode, true);
      this.gantt.scroll_current?.();
    }
  }

  private attachPopupToOverlay(): void {
    if (!this.gantt?.$popup_wrapper) {
      return;
    }

    const popupWrapper = this.gantt.$popup_wrapper as HTMLDivElement;
    const popupHost = this.popupHost.nativeElement;
    const originalShowPopup = this.gantt.show_popup.bind(this.gantt);

    popupHost.appendChild(popupWrapper);
    popupWrapper.classList.add('hide');
    popupWrapper.style.left = '0';
    popupWrapper.style.top = '0';

    this.gantt.show_popup = (options: { x: number; y: number; task: FrappeTask; target: SVGElement }) => {
      const targetRect = options.target.getBoundingClientRect();
      originalShowPopup({ ...options, x: 0, y: 0 });

      const popupRect = popupWrapper.getBoundingClientRect();
      const viewportPadding = 16;
      const preferredLeft = targetRect.right + 12;
      const fallbackLeft = targetRect.left - popupRect.width - 12;
      const maxLeft = window.innerWidth - popupRect.width - viewportPadding;
      const centeredTop = targetRect.top + (targetRect.height - popupRect.height) / 2;
      const maxTop = window.innerHeight - popupRect.height - viewportPadding;
      const resolvedLeft =
        preferredLeft <= maxLeft ? preferredLeft : Math.max(viewportPadding, fallbackLeft);
      const clampedTop = Math.max(viewportPadding, Math.min(centeredTop, maxTop));

      popupWrapper.style.left = `${resolvedLeft}px`;
      popupWrapper.style.top = `${clampedTop}px`;
      popupWrapper.style.zIndex = '1200';
    };
  }

  private renderGantt(): void {
    const container = this.container.nativeElement as HTMLDivElement;
    container.innerHTML = '';
    this.clearPopupHost();

    if (!this.tasks.length) {
      this.gantt = null;
      return;
    }

    this.gantt = new Gantt(container, this.tasks, {
      view_mode: this.currentViewMode,
      popup_on: 'hover',
      scroll_to: 'today',
      on_date_change: (task: FrappeTask, start: Date, end: Date) =>
        this.dateChanged.emit({ task, start, end }),
      on_progress_change: (task: FrappeTask, progress: number) =>
        this.progressChanged.emit({ task, progress }),
      on_click: (task: FrappeTask) => {
        this.hidePopup();
        this.taskClicked.emit(task);
      },
    });

    this.attachPopupToOverlay();
    this.scheduleInitialLayout();
  }

  private clearPopupHost(): void {
    if (!this.popupHost) {
      return;
    }

    this.popupHost.nativeElement.innerHTML = '';
  }

  private hidePopup(): void {
    this.gantt?.hide_popup?.();
  }

  private scheduleInitialLayout(): void {
    if (this.layoutFrameId !== null) {
      cancelAnimationFrame(this.layoutFrameId);
    }
    if (this.layoutTimeoutId !== null) {
      clearTimeout(this.layoutTimeoutId);
    }

    this.layoutFrameId = requestAnimationFrame(() => {
      this.layoutFrameId = null;
      this.runLayoutPass();
    });

    this.layoutTimeoutId = setTimeout(() => {
      this.layoutTimeoutId = null;
      this.runLayoutPass();
    }, 40);
  }

  private runLayoutPass(): void {
    if (!this.gantt) {
      return;
    }

    this.gantt.refresh(this.tasks);
    const fallbackMode: ViewMode = this.currentViewMode === 'Day' ? 'Week' : 'Day';
    this.gantt.change_view_mode(fallbackMode, true);
    this.gantt.change_view_mode(this.currentViewMode, true);
    this.gantt.scroll_current?.();
  }

  private observeContainerResize(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !this.gantt || !this.tasks.length) {
        return;
      }

      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        this.scheduleInitialLayout();
      }
    });

    this.resizeObserver.observe(this.container.nativeElement);
  }
}
