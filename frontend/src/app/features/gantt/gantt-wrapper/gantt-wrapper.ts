import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { TaskDependencyItem } from '../../../core/models/task.model';
import { FrappeTask } from '../../../core/models/frappe-task.model';
import { ViewMode } from '../gantt-controls/gantt-controls';

declare const Gantt: any;

type GanttDateChangeEvent = { task: FrappeTask; start: Date; end: Date };

@Component({
  selector: 'app-gantt-wrapper',
  imports: [],
  templateUrl: './gantt-wrapper.html',
  styleUrl: './gantt-wrapper.scss',
})
export class GanttWrapper implements AfterViewInit, OnChanges, OnDestroy {
  @Input() tasks: FrappeTask[] = [];
  @Output() dateDragging = new EventEmitter<GanttDateChangeEvent[]>();
  @Output() dateChanged = new EventEmitter<GanttDateChangeEvent[]>();
  @Output() progressChanged = new EventEmitter<{ task: FrappeTask; progress: number }>();
  @Output() taskClicked = new EventEmitter<FrappeTask>();
  protected readonly isRendering = signal(false);

  @ViewChild('ganttContainer') container!: ElementRef;
  @ViewChild('popupHost') popupHost!: ElementRef<HTMLDivElement>;

  private gantt: any = null;
  private currentViewMode: ViewMode = 'Day';
  private currentColumnWidth: number | null = null;
  private viewInitialized = false;
  private resizeObserver: ResizeObserver | null = null;
  private lastObservedContainerWidth = 0;
  private layoutFrameId: number | null = null;
  private layoutTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private dependencyRedrawTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private dependencyRedrawFrameId: number | null = null;
  private dragRedrawFrameId: number | null = null;
  private loaderTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly svgNs = 'http://www.w3.org/2000/svg';
  private pendingScrollLeft: number | null = null;
  private recenterToTodayOnNextRender = false;
  private redrawSequence = 0;
  private activeLoaderToken: number | null = null;
  private nextLoaderToken = 0;
  private isDateDragActive = false;
  private hasActiveDragMovement = false;
  private activeDragTaskId: string | null = null;
  private activeDragMode: 'move' | 'resize-left' | 'resize-right' | null = null;
  private activeDragSubtreeTaskIds: string[] = [];
  private activeDragOriginalTaskDates = new Map<string, { start: Date; end: Date }>();
  private activeDragLiveTaskDates = new Map<string, { start: Date; end: Date }>();
  private lastDragEmission = new Map<string, string>();
  private pendingDragDateChanges = new Map<string, GanttDateChangeEvent>();
  private readonly debugLoggingEnabled = true;

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
    this.detachLiveDragTracking();
    this.resizeObserver?.disconnect();
    if (this.layoutFrameId !== null) {
      cancelAnimationFrame(this.layoutFrameId);
    }
    if (this.layoutTimeoutId !== null) {
      clearTimeout(this.layoutTimeoutId);
    }
    if (this.dependencyRedrawTimeoutId !== null) {
      clearTimeout(this.dependencyRedrawTimeoutId);
    }
    if (this.dependencyRedrawFrameId !== null) {
      cancelAnimationFrame(this.dependencyRedrawFrameId);
    }
    if (this.dragRedrawFrameId !== null) {
      cancelAnimationFrame(this.dragRedrawFrameId);
    }
    if (this.loaderTimeoutId !== null) {
      clearTimeout(this.loaderTimeoutId);
    }
    this.clearPopupHost();
    this.gantt = null;
  }

  setViewMode(mode: ViewMode): void {
    this.currentViewMode = mode;
    this.currentColumnWidth = null;

    if (this.viewInitialized) {
      this.activeLoaderToken = ++this.nextLoaderToken;
      this.isRendering.set(true);
      this.debugLog('setViewMode:start', {
        mode,
        loaderToken: this.activeLoaderToken,
      });
      this.armLoaderFallback(this.activeLoaderToken);
      this.renderGantt();
    }
  }

  recenterToToday(): void {
    this.recenterToTodayOnNextRender = true;
    this.pendingScrollLeft = null;
    this.debugLog('recenterToToday:requested', {
      pendingScrollLeft: this.pendingScrollLeft,
      recenterToTodayOnNextRender: this.recenterToTodayOnNextRender,
    });
  }

  renderCenteredToToday(): void {
    this.recenterToToday();
    this.debugLog('renderCenteredToToday:start', {
      viewInitialized: this.viewInitialized,
      hasGantt: Boolean(this.gantt),
    });
    if (!this.viewInitialized) {
      return;
    }

    this.renderGantt();
  }

  scrollToTodayNow(): void {
    this.pendingScrollLeft = null;
    const beforeScrollLeft = this.getCurrentScrollLeft();
    this.scrollTodayIntoView();
    requestAnimationFrame(() => {
      this.debugLog('scrollToTodayNow:after-scroll', {
        beforeScrollLeft,
        afterScrollLeft: this.getCurrentScrollLeft(),
      });
    });
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
    const existingScrollHost = container.querySelector('.gantt-container') as HTMLDivElement | null;
    const existingScrollLeft = existingScrollHost?.scrollLeft ?? null;
    this.pendingScrollLeft = this.recenterToTodayOnNextRender
      ? null
      : existingScrollLeft;
    this.detachLiveDragTracking();
    container.innerHTML = '';
    this.clearPopupHost();
    this.debugLog('renderGantt:start', {
      tasks: this.tasks.length,
      viewMode: this.currentViewMode,
      loaderToken: this.activeLoaderToken,
      existingScrollLeft,
      pendingScrollLeft: this.pendingScrollLeft,
      recenterToTodayOnNextRender: this.recenterToTodayOnNextRender,
    });

    if (!this.tasks.length) {
      this.gantt = null;
      this.isRendering.set(false);
      this.activeLoaderToken = null;
      if (this.loaderTimeoutId !== null) {
        clearTimeout(this.loaderTimeoutId);
        this.loaderTimeoutId = null;
      }
      return;
    }

    const seededColumnWidth = this.currentColumnWidth ?? this.getBaseColumnWidth(this.currentViewMode);
    this.gantt = new Gantt(container, this.tasks, {
      view_mode: this.currentViewMode,
      column_width: seededColumnWidth,
      popup_on: 'hover',
      scroll_to: 'today',
      move_dependencies: true,
      on_date_change: (task: FrappeTask, start: Date, end: Date) =>
        this.handleGanttDateChange(task, start, end),
      on_progress_change: (task: FrappeTask, progress: number) =>
        this.progressChanged.emit({ task, progress }),
      on_click: (task: FrappeTask) => {
        this.hidePopup();
        this.taskClicked.emit(task);
      },
    });

    const desiredColumnWidth = this.getDesiredColumnWidth();
    if (desiredColumnWidth !== null && desiredColumnWidth !== seededColumnWidth) {
      this.currentColumnWidth = desiredColumnWidth;
      this.debugLog('renderGantt:rerender-for-column-width', {
        seededColumnWidth,
        desiredColumnWidth,
        loaderToken: this.activeLoaderToken,
      });
      this.renderGantt();
      return;
    }

    this.attachPopupToOverlay();
    this.attachLiveDragTracking();
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

  private attachLiveDragTracking(): void {
    const svg = this.container.nativeElement.querySelector('svg.gantt') as SVGSVGElement | null;
    if (!svg) {
      return;
    }

    svg.addEventListener('mousedown', this.handleSvgPointerDown);
    svg.addEventListener('mousemove', this.handleSvgPointerMove);
    document.addEventListener('mouseup', this.handleDocumentPointerUp);
  }

  private detachLiveDragTracking(): void {
    const svg = this.container?.nativeElement?.querySelector?.('svg.gantt') as SVGSVGElement | null;
    svg?.removeEventListener('mousedown', this.handleSvgPointerDown);
    svg?.removeEventListener('mousemove', this.handleSvgPointerMove);
    document.removeEventListener('mouseup', this.handleDocumentPointerUp);
    this.isDateDragActive = false;
    this.hasActiveDragMovement = false;
    this.activeDragTaskId = null;
    this.activeDragMode = null;
    this.activeDragSubtreeTaskIds = [];
    this.activeDragOriginalTaskDates.clear();
    this.activeDragLiveTaskDates.clear();
    this.lastDragEmission.clear();
    this.pendingDragDateChanges.clear();
    if (this.dragRedrawFrameId !== null) {
      cancelAnimationFrame(this.dragRedrawFrameId);
      this.dragRedrawFrameId = null;
    }
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
      this.debugLog('scheduleInitialLayout:animation-frame', {
        loaderToken: this.activeLoaderToken,
      });
      this.runLayoutPass();
    });

    this.layoutTimeoutId = setTimeout(() => {
      this.layoutTimeoutId = null;
      this.debugLog('scheduleInitialLayout:timeout', {
        loaderToken: this.activeLoaderToken,
      });
      this.runLayoutPass();
    }, 40);
  }

  private runLayoutPass(): void {
    if (!this.gantt) {
      this.debugLog('runLayoutPass:skipped-no-gantt', {
        loaderToken: this.activeLoaderToken,
      });
      return;
    }

    const desiredColumnWidth = this.getDesiredColumnWidth();
    if (desiredColumnWidth !== null && desiredColumnWidth !== this.currentColumnWidth) {
      this.currentColumnWidth = desiredColumnWidth;
      this.debugLog('runLayoutPass:rerender-for-column-width', {
        desiredColumnWidth,
        loaderToken: this.activeLoaderToken,
        viewMode: this.currentViewMode,
      });
      this.renderGantt();
      return;
    }

    this.debugLog('runLayoutPass:start', {
      loaderToken: this.activeLoaderToken,
      viewMode: this.currentViewMode,
    });
    this.gantt.refresh(this.tasks);
    this.gantt.change_view_mode(this.currentViewMode, true);
    requestAnimationFrame(() => {
      this.debugLog('runLayoutPass:post-render-frame', {
        loaderToken: this.activeLoaderToken,
        viewMode: this.currentViewMode,
      });
      this.freezeSvgAnimations();
      this.restoreScrollPosition();
      this.scheduleDependencyRedraw();
    });
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
      if (width > 0 && height > 0 && Math.round(width) !== this.lastObservedContainerWidth) {
        this.lastObservedContainerWidth = Math.round(width);
        this.debugLog('observeContainerResize:trigger-layout', {
          width,
          height,
          loaderToken: this.activeLoaderToken,
        });
        this.scheduleInitialLayout();
      }
    });

    this.resizeObserver.observe(this.container.nativeElement);
  }

  private restoreScrollPosition(): void {
    const scrollHost = this.container.nativeElement.querySelector(
      '.gantt-container',
    ) as HTMLDivElement | null;

    if (!scrollHost) {
      return;
    }

    if (this.pendingScrollLeft !== null) {
      this.debugLog('restoreScrollPosition:preserve', {
        pendingScrollLeft: this.pendingScrollLeft,
        beforeScrollLeft: scrollHost.scrollLeft,
      });
      scrollHost.scrollLeft = this.pendingScrollLeft;
      this.pendingScrollLeft = null;
      this.recenterToTodayOnNextRender = false;
      this.debugLog('restoreScrollPosition:preserve-applied', {
        afterScrollLeft: scrollHost.scrollLeft,
      });
      return;
    }

    const beforeScrollLeft = scrollHost.scrollLeft;
    this.debugLog('restoreScrollPosition:scroll-current', {
      beforeScrollLeft,
      recenterToTodayOnNextRender: this.recenterToTodayOnNextRender,
    });
    this.scrollTodayIntoView();
    this.recenterToTodayOnNextRender = false;
    requestAnimationFrame(() => {
      this.debugLog('restoreScrollPosition:scroll-current-applied', {
        beforeScrollLeft,
        afterScrollLeft: this.getCurrentScrollLeft(),
      });
    });
  }

  private getCurrentScrollLeft(): number | null {
    const scrollHost = this.container?.nativeElement?.querySelector?.('.gantt-container') as
      | HTMLDivElement
      | null;
    return scrollHost?.scrollLeft ?? null;
  }

  private parseTaskDate(value: string): Date {
    const [year, month, day] = value.split('T')[0].split('-').map((part) => Number(part));
    return new Date(year, month - 1, day);
  }

  private toLocalDateOnly(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private getInclusiveDurationDays(start: Date, end: Date): number {
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private maxDate(left: Date, right: Date): Date {
    return left.getTime() >= right.getTime() ? left : right;
  }

  private scrollTodayIntoView(): void {
    const scrollHost = this.container?.nativeElement?.querySelector?.('.gantt-container') as
      | HTMLDivElement
      | null;
    if (!scrollHost) {
      return;
    }

    const todayKey = this.formatDateKey(new Date());
    const todayCell = this.container.nativeElement.querySelector(
      `.lower-text.date_${todayKey}`,
    ) as HTMLElement | null;

    if (!todayCell) {
      this.debugLog('scrollTodayIntoView:no-today-cell', {
        todayKey,
      });
      this.gantt?.scroll_current?.();
      return;
    }

    const targetLeft = Math.max(
      0,
      todayCell.offsetLeft - scrollHost.clientWidth / 2 + todayCell.clientWidth / 2,
    );
    this.debugLog('scrollTodayIntoView:target', {
      todayKey,
      currentScrollLeft: scrollHost.scrollLeft,
      targetLeft,
      todayOffsetLeft: todayCell.offsetLeft,
      todayWidth: todayCell.clientWidth,
      containerWidth: scrollHost.clientWidth,
    });
    scrollHost.scrollLeft = targetLeft;
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private readonly handleSvgPointerDown = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    if (!target) {
      return;
    }

    const isDateHandle = target.classList.contains('bar-wrapper')
      || target.classList.contains('left')
      || target.classList.contains('right')
      || target.closest('.bar-wrapper') !== null;
    const isProgressHandle = target.classList.contains('progress');

    if (!isDateHandle || isProgressHandle) {
      return;
    }

    const isLeftHandle = target.classList.contains('left');
    const isRightHandle = target.classList.contains('right');

    this.isDateDragActive = true;
    this.hasActiveDragMovement = false;
    this.activeDragTaskId = target.closest('.bar-wrapper')?.getAttribute('data-id') ?? null;
    this.activeDragMode = isLeftHandle ? 'resize-left' : isRightHandle ? 'resize-right' : 'move';
    this.activeDragSubtreeTaskIds = this.activeDragTaskId
      ? this.getSuccessorTaskIds(this.activeDragTaskId)
      : [];
    this.activeDragOriginalTaskDates = this.captureOriginalTaskDates(
      this.activeDragTaskId ? [this.activeDragTaskId, ...this.activeDragSubtreeTaskIds] : [],
    );
    this.activeDragLiveTaskDates = new Map(this.activeDragOriginalTaskDates);
    this.lastDragEmission.clear();
    this.pendingDragDateChanges.clear();
    this.hidePopup();
    this.debugLog('liveDrag:start', {
      activeDragTaskId: this.activeDragTaskId,
      activeDragMode: this.activeDragMode,
      activeDragSubtreeTaskIds: this.activeDragSubtreeTaskIds,
      activeLoaderToken: this.activeLoaderToken,
    });
  };

  private readonly handleSvgPointerMove = (): void => {
    if (!this.isDateDragActive || !this.gantt?.bar_being_dragged) {
      return;
    }

    this.hasActiveDragMovement = true;

    if (this.dragRedrawFrameId !== null) {
      return;
    }

    this.dragRedrawFrameId = requestAnimationFrame(() => {
      this.dragRedrawFrameId = null;
      this.syncDraggedSubtreeBars();
      this.emitLiveDraggedDates();
      this.drawCustomDependencies(++this.redrawSequence, null);
    });
  };

  private readonly handleDocumentPointerUp = (): void => {
    if (!this.isDateDragActive) {
      return;
    }

    const draggedTaskId = this.activeDragTaskId;

    if (this.dragRedrawFrameId !== null) {
      cancelAnimationFrame(this.dragRedrawFrameId);
      this.dragRedrawFrameId = null;
    }

    queueMicrotask(() => {
      requestAnimationFrame(() => {
        if (this.hasActiveDragMovement || this.pendingDragDateChanges.size) {
          const updates = this.collectActiveDragDateChangesFromLiveState(true);
          if (updates.length) {
            this.dateChanged.emit(updates);
          } else if (this.pendingDragDateChanges.size) {
            this.dateChanged.emit(Array.from(this.pendingDragDateChanges.values()));
          }
        }
        this.emitActiveDraggedTaskSelection();

        this.isDateDragActive = false;
        this.hasActiveDragMovement = false;
        this.activeDragTaskId = null;
        this.activeDragMode = null;
        this.activeDragSubtreeTaskIds = [];
        this.activeDragOriginalTaskDates.clear();
        this.activeDragLiveTaskDates.clear();
        this.lastDragEmission.clear();
        this.pendingDragDateChanges.clear();
        this.scheduleDependencyRedraw();
      });
    });

    this.debugLog('liveDrag:end', {
      activeLoaderToken: this.activeLoaderToken,
    });
  };

  private emitLiveDraggedDates(): void {
    const updates = this.collectActiveDragDateChangesFromLiveState(false);
    if (updates.length) {
      this.dateDragging.emit(updates);
    }
  }

  private handleGanttDateChange(task: FrappeTask, start: Date, end: Date): void {
    const normalizedChange = this.normalizeDateChange(task, start, end);
    if (this.isDateDragActive) {
      this.pendingDragDateChanges.set(task.id, normalizedChange);
      return;
    }

    this.dateChanged.emit([normalizedChange]);
  }

  private collectActiveDragDateChanges(includeUnchanged = false): GanttDateChangeEvent[] {
    if (!this.gantt?.bars?.length) {
      return [];
    }

    const taskIds = this.activeDragTaskId
      ? [this.activeDragTaskId, ...this.getSuccessorTaskIds(this.activeDragTaskId)]
      : this.getDraggedTaskIds();
    const updates: GanttDateChangeEvent[] = [];

    for (const taskId of Array.from(new Set(taskIds))) {
      const bar = this.gantt.get_bar?.(taskId) as
        | {
            task: FrappeTask;
            $bar: SVGGraphicsElement & { finaldx?: number };
            compute_start_end_date?: () => { new_start_date: Date; new_end_date: Date };
          }
        | undefined;
      if (!bar || typeof bar.compute_start_end_date !== 'function') {
        continue;
      }

      if (!includeUnchanged && !Number(bar.$bar?.finaldx ?? 0)) {
        continue;
      }

      const { new_start_date, new_end_date } = bar.compute_start_end_date();
      const change = this.normalizeDateChange(
        bar.task,
        new_start_date,
        new Date(new_end_date.getTime() - 1000),
      );
      const signature = `${change.start.getTime()}:${change.end.getTime()}`;
      if (!includeUnchanged && this.lastDragEmission.get(bar.task.id) === signature) {
        continue;
      }

      this.lastDragEmission.set(bar.task.id, signature);
      updates.push(change);
    }

    return updates;
  }

  private normalizeDateChange(task: FrappeTask, start: Date, end: Date): GanttDateChangeEvent {
    return { task, start, end };
  }

  private syncDraggedSubtreeBars(): void {
    if (!this.activeDragTaskId || !this.activeDragSubtreeTaskIds.length || !this.gantt?.get_bar) {
      return;
    }

    const activeBar = this.gantt.get_bar(this.activeDragTaskId) as
      | {
          $bar: SVGGraphicsElement & {
            finaldx?: number;
            ox?: number;
            oy?: number;
            owidth?: number;
            getX?: () => number;
            getY?: () => number;
            getWidth?: () => number;
          };
          compute_start_end_date?: () => { new_start_date: Date; new_end_date: Date };
        }
      | undefined;
    if (!activeBar || typeof activeBar.compute_start_end_date !== 'function') {
      return;
    }

    const { new_start_date, new_end_date } = activeBar.compute_start_end_date();
    const liveTaskDates = new Map(this.activeDragOriginalTaskDates);
    liveTaskDates.set(this.activeDragTaskId, {
      start: this.toLocalDateOnly(new_start_date),
      end: this.toLocalDateOnly(new Date(new_end_date.getTime() - 1000)),
    });
    const subtreeTaskIds = this.getLivePropagationOrder(this.activeDragSubtreeTaskIds);
    const maxPasses = Math.max(1, subtreeTaskIds.length);

    for (let pass = 0; pass < maxPasses; pass += 1) {
      let changedInPass = false;

      for (const taskId of subtreeTaskIds) {
        const task = this.tasks.find((entry) => entry.id === taskId);
        const originalDates = this.activeDragOriginalTaskDates.get(taskId);
        if (!task || !originalDates) {
          continue;
        }

        const nextDates =
          this.calculateLivePropagatedDates(taskId, task, liveTaskDates, originalDates)
          ?? originalDates;

        const previousDates = liveTaskDates.get(taskId);
        const datesChanged = !previousDates
          || previousDates.start.getTime() !== nextDates.start.getTime()
          || previousDates.end.getTime() !== nextDates.end.getTime();

        if (!datesChanged && pass > 0) {
          continue;
        }

        changedInPass = changedInPass || datesChanged;
        this.debugLog('syncDraggedSubtreeBars:live-propagated', {
          taskId,
          mode: this.activeDragMode,
          pass,
          start: this.formatDateKey(nextDates.start),
          end: this.formatDateKey(nextDates.end),
        });
        liveTaskDates.set(taskId, nextDates);
        this.updateBarToDates(taskId, nextDates.start, nextDates.end);
      }

      if (!changedInPass) {
        break;
      }
    }

    this.activeDragLiveTaskDates = liveTaskDates;
  }

  private collectActiveDragDateChangesFromLiveState(
    includePreviouslyEmitted: boolean,
  ): GanttDateChangeEvent[] {
    if (!this.activeDragTaskId || !this.activeDragLiveTaskDates.size) {
      return [];
    }

    const taskIds = [this.activeDragTaskId, ...this.activeDragSubtreeTaskIds];
    const updates: GanttDateChangeEvent[] = [];

    for (const taskId of Array.from(new Set(taskIds))) {
      const task = this.tasks.find((entry) => entry.id === taskId);
      const dates = this.activeDragLiveTaskDates.get(taskId);
      if (!task || !dates) {
        continue;
      }

      const signature = `${dates.start.getTime()}:${dates.end.getTime()}`;
      if (!includePreviouslyEmitted && this.lastDragEmission.get(taskId) === signature) {
        continue;
      }

      this.lastDragEmission.set(taskId, signature);
      updates.push(this.normalizeDateChange(task, dates.start, dates.end));
    }

    return updates;
  }

  private getLivePropagationOrder(taskIds: string[]): string[] {
    const remaining = new Set(taskIds);
    const ordered: string[] = [];

    while (remaining.size) {
      let progressed = false;

      for (const taskId of Array.from(remaining)) {
        const task = this.tasks.find((entry) => entry.id === taskId);
        const unresolvedInternalDependency = (task?.dependencyItems ?? []).some(
          (dependency) => remaining.has(dependency.predecessorId),
        );

        if (unresolvedInternalDependency) {
          continue;
        }

        ordered.push(taskId);
        remaining.delete(taskId);
        progressed = true;
      }

      if (!progressed) {
        ordered.push(...remaining);
        break;
      }
    }

    return ordered;
  }

  private calculateLivePropagatedDates(
    taskId: string,
    task: FrappeTask,
    liveTaskDates: Map<string, { start: Date; end: Date }>,
    originalDates: { start: Date; end: Date },
  ): { start: Date; end: Date } | null {
    const shiftedOriginalDates = this.getShiftedOriginalDates(task, originalDates, liveTaskDates);
    let minStart = shiftedOriginalDates.start;
    let minEnd = shiftedOriginalDates.end;

    for (const dependency of task.dependencyItems ?? []) {
      const predecessorDates = this.getLiveConstraintDates(dependency.predecessorId, liveTaskDates);
      if (!predecessorDates) {
        continue;
      }

      if (dependency.type === 'FinishToStart') {
        minStart = this.maxDate(minStart, this.addDays(predecessorDates.end, 1));
      }

      if (dependency.type === 'StartToStart') {
        minStart = this.maxDate(minStart, predecessorDates.start);
      }

      if (dependency.type === 'FinishToFinish') {
        minEnd = this.maxDate(minEnd, predecessorDates.end);
      }
    }

    const durationDays = this.getInclusiveDurationDays(originalDates.start, originalDates.end);
    let nextStart = minStart;
    let nextEnd = this.addDays(nextStart, Math.max(durationDays - 1, 0));
    if (nextEnd.getTime() < minEnd.getTime()) {
      nextEnd = minEnd;
      nextStart = this.addDays(nextEnd, -Math.max(durationDays - 1, 0));
    }

    const currentDates = liveTaskDates.get(taskId);
    if (
      currentDates
      && currentDates.start.getTime() === nextStart.getTime()
      && currentDates.end.getTime() === nextEnd.getTime()
    ) {
      return null;
    }

    return { start: nextStart, end: nextEnd };
  }

  private getShiftedOriginalDates(
    task: FrappeTask,
    originalDates: { start: Date; end: Date },
    liveTaskDates: Map<string, { start: Date; end: Date }>,
  ): { start: Date; end: Date } {
    const shiftDays = this.getWholeTaskShiftDays(task, liveTaskDates);
    if (!shiftDays) {
      return originalDates;
    }

    return {
      start: this.addDays(originalDates.start, shiftDays),
      end: this.addDays(originalDates.end, shiftDays),
    };
  }

  private getWholeTaskShiftDays(
    task: FrappeTask,
    liveTaskDates: Map<string, { start: Date; end: Date }>,
  ): number {
    const shiftCandidates: number[] = [];

    for (const dependency of task.dependencyItems ?? []) {
      const shiftDays = this.getDependencyShiftDays(dependency.predecessorId, dependency.type, liveTaskDates);
      if (shiftDays === null) {
        continue;
      }

      shiftCandidates.push(shiftDays);
    }

    return shiftCandidates.length ? Math.max(...shiftCandidates) : 0;
  }

  private getDependencyShiftDays(
    predecessorId: string,
    dependencyType: TaskDependencyItem['type'],
    liveTaskDates: Map<string, { start: Date; end: Date }>,
  ): number | null {
    const predecessorLiveDates = this.getLiveConstraintDates(predecessorId, liveTaskDates);
    const predecessorOriginalDates = this.getOriginalConstraintDates(predecessorId);
    if (!predecessorLiveDates || !predecessorOriginalDates) {
      return null;
    }

    const liveAnchor = dependencyType === 'StartToStart'
      ? predecessorLiveDates.start
      : predecessorLiveDates.end;
    const originalAnchor = dependencyType === 'StartToStart'
      ? predecessorOriginalDates.start
      : predecessorOriginalDates.end;

    return Math.round((liveAnchor.getTime() - originalAnchor.getTime()) / 86_400_000);
  }

  private getOriginalConstraintDates(taskId: string): { start: Date; end: Date } | null {
    const originalDates = this.activeDragOriginalTaskDates.get(taskId);
    if (originalDates) {
      return originalDates;
    }

    const task = this.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return null;
    }

    return {
      start: this.parseTaskDate(task.start),
      end: this.parseTaskDate(task.end),
    };
  }

  private getLiveConstraintDates(
    taskId: string,
    liveTaskDates: Map<string, { start: Date; end: Date }>,
  ): { start: Date; end: Date } | null {
    const liveDates = liveTaskDates.get(taskId);
    if (liveDates) {
      return liveDates;
    }

    const task = this.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      return null;
    }

    return {
      start: this.parseTaskDate(task.start),
      end: this.parseTaskDate(task.end),
    };
  }

  private updateBarToDates(taskId: string, start: Date, end: Date): void {
    const bar = this.gantt.get_bar(taskId) as
      | {
          task: FrappeTask & { _start?: Date; _end?: Date };
          x?: number;
          duration?: number;
          gantt?: { config?: { column_width?: number } };
          compute_x?: () => void;
          compute_duration?: () => void;
          update_bar_position?: (input: { x?: number | null; width?: number | null }) => void;
          $bar: SVGGraphicsElement & {
            finaldx?: number;
            ox?: number;
            owidth?: number;
            getWidth?: () => number;
          };
        }
      | undefined;
    if (
      !bar?.$bar
      || typeof bar.compute_x !== 'function'
      || typeof bar.compute_duration !== 'function'
      || typeof bar.update_bar_position !== 'function'
    ) {
      return;
    }

    const desiredStart = new Date(start);
    const desiredExclusiveEnd = this.addDays(end, 1);
    bar.task._start = desiredStart;
    bar.task._end = desiredExclusiveEnd;
    bar.compute_x();
    bar.compute_duration();
    const columnWidth = bar.gantt?.config?.column_width ?? 0;
    const computedWidth = columnWidth > 0 && typeof bar.duration === 'number'
      ? columnWidth * bar.duration
      : (bar.$bar.owidth ?? bar.$bar.getWidth?.() ?? null);
    this.debugLog('updateBarToDates:apply', {
      taskId,
      start: this.formatDateKey(start),
      end: this.formatDateKey(end),
      x: bar.x ?? null,
      width: computedWidth,
      columnWidth,
      duration: typeof bar.duration === 'number' ? bar.duration : null,
    });
    bar.$bar.finaldx = 0;
    bar.update_bar_position({
      x: bar.x ?? null,
      width: computedWidth,
    });
  }

  private captureOriginalTaskDates(taskIds: string[]): Map<string, { start: Date; end: Date }> {
    const result = new Map<string, { start: Date; end: Date }>();

    for (const taskId of taskIds) {
      const task = this.tasks.find((entry) => entry.id === taskId);
      if (!task) {
        continue;
      }

      result.set(taskId, {
        start: this.parseTaskDate(task.start),
        end: this.parseTaskDate(task.end),
      });
    }

    return result;
  }

  private emitActiveDraggedTaskSelection(): void {
    if (!this.activeDragTaskId) {
      return;
    }

    this.emitTaskSelectionById(this.activeDragTaskId);
  }

  private emitTaskSelectionById(taskId: string): void {
    const activeTask = this.tasks.find((task) => task.id === taskId);
    if (!activeTask) {
      return;
    }

    this.hidePopup();
    this.taskClicked.emit(activeTask);
  }

  private getDraggedTaskIds(): string[] {
    if (!this.gantt?.bars?.length) {
      return [];
    }

    return (this.gantt.bars as Array<{ task: FrappeTask; $bar: SVGGraphicsElement & { finaldx?: number } }>)
      .filter((bar) => Number(bar.$bar?.finaldx ?? 0))
      .map((bar) => bar.task.id);
  }

  private getSuccessorTaskIds(taskId: string): string[] {
    const visited = new Set<string>();
    const stack = [taskId];

    while (stack.length) {
      const currentTaskId = stack.pop()!;
      for (const task of this.tasks) {
        const dependsOnCurrent = (task.dependencyItems ?? []).some(
          (dependency) => dependency.predecessorId === currentTaskId,
        );
        if (!dependsOnCurrent || visited.has(task.id) || task.id === taskId) {
          continue;
        }

        visited.add(task.id);
        stack.push(task.id);
      }
    }

    return Array.from(visited);
  }

  private drawCustomDependencies(sequence: number, loaderToken: number | null): void {
    const svg = this.container.nativeElement.querySelector('svg.gantt') as SVGSVGElement | null;
    if (!svg) {
      this.debugLog('drawCustomDependencies:no-svg', {
        sequence,
        loaderToken,
        activeLoaderToken: this.activeLoaderToken,
      });
      this.completeLoaderIfActive(loaderToken);
      return;
    }

    svg.querySelector('.arrow')?.setAttribute('display', 'none');
    svg.querySelector('.custom-dependencies')?.remove();
    this.ensureCustomArrowMarker(svg);

    const layer = document.createElementNS(this.svgNs, 'g');
    layer.setAttribute('class', 'custom-dependencies');
    const firstBarGroup = svg.querySelector('.bar-wrapper')?.parentNode;
    if (firstBarGroup) {
      svg.insertBefore(layer, firstBarGroup);
    } else {
      svg.appendChild(layer);
    }

    for (const task of this.tasks) {
      for (const dependency of task.dependencyItems ?? []) {
        const predecessorBar = this.getBarRect(svg, dependency.predecessorId);
        const successorBar = this.getBarRect(svg, task.id);

        if (!predecessorBar || !successorBar) {
          continue;
        }

        const path = document.createElementNS(this.svgNs, 'path');
        path.setAttribute('class', `custom-arrow dependency-${this.toDependencyClass(dependency)}`);
        path.setAttribute('d', this.buildDependencyPath(predecessorBar, successorBar, dependency));
        path.setAttribute('marker-end', 'url(#custom-arrowhead)');
        layer.appendChild(path);
      }
    }

    this.debugLog('drawCustomDependencies:done', {
      sequence,
      loaderToken,
      activeLoaderToken: this.activeLoaderToken,
      dependencies: layer.childElementCount,
    });
    this.completeLoaderIfActive(loaderToken);
  }

  private scheduleDependencyRedraw(): void {
    if (this.dependencyRedrawTimeoutId !== null) {
      clearTimeout(this.dependencyRedrawTimeoutId);
    }
    if (this.dependencyRedrawFrameId !== null) {
      cancelAnimationFrame(this.dependencyRedrawFrameId);
    }

    const sequence = ++this.redrawSequence;
    const loaderToken = this.activeLoaderToken;
    this.debugLog('scheduleDependencyRedraw:start', {
      sequence,
      loaderToken,
      activeLoaderToken: this.activeLoaderToken,
    });
    this.waitForStableBars(sequence, loaderToken);

    this.dependencyRedrawTimeoutId = setTimeout(() => {
      this.dependencyRedrawTimeoutId = null;
      this.debugLog('scheduleDependencyRedraw:timeout-fire', {
        sequence,
        loaderToken,
        activeLoaderToken: this.activeLoaderToken,
      });
      this.drawCustomDependencies(sequence, loaderToken);
    }, 320);
  }

  private waitForStableBars(
    sequence: number,
    loaderToken: number | null,
    previousSnapshot: string | null = null,
    stableFrames = 0,
    remainingFrames = 18,
  ): void {
    this.dependencyRedrawFrameId = requestAnimationFrame(() => {
      const snapshot = this.captureBarGeometrySnapshot();

      if (!snapshot) {
        this.dependencyRedrawFrameId = null;
        this.debugLog('waitForStableBars:no-snapshot', {
          sequence,
          loaderToken,
          activeLoaderToken: this.activeLoaderToken,
        });
        this.completeLoaderIfActive(loaderToken);
        return;
      }

      const nextStableFrames = snapshot === previousSnapshot ? stableFrames + 1 : 0;
      if (nextStableFrames >= 2 || remainingFrames <= 0) {
        this.dependencyRedrawFrameId = null;
        this.debugLog('waitForStableBars:stable', {
          sequence,
          loaderToken,
          activeLoaderToken: this.activeLoaderToken,
          stableFrames: nextStableFrames,
          remainingFrames,
        });
        this.drawCustomDependencies(sequence, loaderToken);
        return;
      }

      this.debugLog('waitForStableBars:retry', {
        sequence,
        loaderToken,
        activeLoaderToken: this.activeLoaderToken,
        stableFrames: nextStableFrames,
        remainingFrames,
      });
      this.waitForStableBars(sequence, loaderToken, snapshot, nextStableFrames, remainingFrames - 1);
    });
  }

  private completeLoaderIfActive(loaderToken: number | null): void {
    this.debugLog('completeLoaderIfActive:attempt', {
      loaderToken,
      activeLoaderToken: this.activeLoaderToken,
      isRendering: this.isRendering(),
    });
    if (loaderToken === null || loaderToken !== this.activeLoaderToken) {
      this.debugLog('completeLoaderIfActive:ignored', {
        loaderToken,
        activeLoaderToken: this.activeLoaderToken,
      });
      return;
    }

    if (this.loaderTimeoutId !== null) {
      clearTimeout(this.loaderTimeoutId);
      this.loaderTimeoutId = null;
    }
    this.isRendering.set(false);
    this.activeLoaderToken = null;
    this.debugLog('completeLoaderIfActive:completed', {
      loaderToken,
      isRendering: this.isRendering(),
    });
  }

  private armLoaderFallback(loaderToken: number): void {
    if (this.loaderTimeoutId !== null) {
      clearTimeout(this.loaderTimeoutId);
    }

    this.debugLog('armLoaderFallback:start', {
      loaderToken,
      activeLoaderToken: this.activeLoaderToken,
    });
    this.loaderTimeoutId = setTimeout(() => {
      this.loaderTimeoutId = null;
      this.debugLog('armLoaderFallback:timeout-fire', {
        loaderToken,
        activeLoaderToken: this.activeLoaderToken,
      });
      this.completeLoaderIfActive(loaderToken);
    }, 1200);
  }

  private debugLog(event: string, payload: Record<string, unknown>): void {
    if (!this.debugLoggingEnabled) {
      return;
    }

    console.debug('[GanttWrapper]', event, payload);
  }

  private captureBarGeometrySnapshot(): string | null {
    const svg = this.container.nativeElement.querySelector('svg.gantt') as SVGSVGElement | null;
    if (!svg) {
      return null;
    }

    const bars = Array.from(svg.querySelectorAll('.bar-wrapper .bar')) as SVGGraphicsElement[];
    if (!bars.length) {
      return null;
    }

    return bars
      .map((bar) => {
        const box = bar.getBBox();
        return [box.x, box.y, box.width, box.height].map((value) => Math.round(value)).join(':');
      })
      .join('|');
  }


  private freezeSvgAnimations(): void {
    const svg = this.container.nativeElement.querySelector('svg.gantt') as SVGSVGElement | null;
    if (!svg) {
      return;
    }

    const animations = Array.from(svg.querySelectorAll('animate'));
    if (!animations.length) {
      return;
    }

    for (const animation of animations) {
      animation.remove();
    }

    this.debugLog('freezeSvgAnimations:removed', {
      count: animations.length,
      loaderToken: this.activeLoaderToken,
      viewMode: this.currentViewMode,
    });
  }

  private getDesiredColumnWidth(): number | null {
    if (!this.gantt?.dates?.length) {
      return null;
    }

    const availableWidth = this.container.nativeElement.clientWidth - 2;
    if (availableWidth <= 0) {
      return null;
    }

    const minColumnWidth = Math.ceil(availableWidth / this.gantt.dates.length);
    return Math.max(this.getBaseColumnWidth(this.currentViewMode), minColumnWidth);
  }

  private getBaseColumnWidth(mode: ViewMode): number {
    switch (mode) {
      case 'Week':
        return 140;
      case 'Month':
        return 120;
      default:
        return 45;
    }
  }

  private ensureCustomArrowMarker(svg: SVGSVGElement): void {
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(this.svgNs, 'defs');
      svg.prepend(defs);
    }

    if (defs.querySelector('#custom-arrowhead')) {
      return;
    }

    const marker = document.createElementNS(this.svgNs, 'marker');
    marker.setAttribute('id', 'custom-arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto-start-reverse');

    const arrowHead = document.createElementNS(this.svgNs, 'path');
    arrowHead.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrowHead.setAttribute('class', 'custom-arrowhead');

    marker.appendChild(arrowHead);
    defs.appendChild(marker);
  }

  private getBarRect(svg: SVGSVGElement, taskId: string): DOMRect | null {
    const bar = svg.querySelector(`.bar-wrapper[data-id="${taskId}"] .bar`) as SVGGraphicsElement | null;
    return bar?.getBBox() ?? null;
  }

  private buildDependencyPath(
    predecessorBar: DOMRect,
    successorBar: DOMRect,
    dependency: TaskDependencyItem,
  ): string {
    const predecessorIsStart = dependency.type === 'StartToStart';
    const successorIsEnd = dependency.type === 'FinishToFinish';

    const startX = predecessorIsStart ? predecessorBar.x : predecessorBar.x + predecessorBar.width;
    const endX = successorIsEnd ? successorBar.x + successorBar.width : successorBar.x;
    const startY = predecessorBar.y + predecessorBar.height / 2;
    const endY = successorBar.y + successorBar.height / 2;
    const horizontalGap = successorIsEnd ? 16 : 20;
    const exitX = predecessorIsStart ? startX - horizontalGap : startX + horizontalGap;
    const entryX = successorIsEnd ? endX + horizontalGap : endX - horizontalGap;
    const verticalMid = startY + (endY - startY) / 2;

    return [
      `M ${startX} ${startY}`,
      `L ${exitX} ${startY}`,
      `L ${entryX} ${verticalMid}`,
      `L ${entryX} ${endY}`,
      `L ${endX} ${endY}`,
    ].join(' ');
  }

  private toDependencyClass(dependency: TaskDependencyItem): string {
    switch (dependency.type) {
      case 'StartToStart':
        return 'ss';
      case 'FinishToFinish':
        return 'ff';
      default:
        return 'fs';
    }
  }
}
