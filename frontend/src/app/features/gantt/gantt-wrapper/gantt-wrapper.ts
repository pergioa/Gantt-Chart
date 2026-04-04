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
import { TaskDependencyItem } from '../../../core/models/task.model';
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
  private currentColumnWidth: number | null = null;
  private viewInitialized = false;
  private resizeObserver: ResizeObserver | null = null;
  private layoutFrameId: number | null = null;
  private layoutTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private dependencyRedrawTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private dependencyRedrawFrameId: number | null = null;
  private readonly svgNs = 'http://www.w3.org/2000/svg';
  private pendingScrollLeft: number | null = null;

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
    if (this.dependencyRedrawTimeoutId !== null) {
      clearTimeout(this.dependencyRedrawTimeoutId);
    }
    if (this.dependencyRedrawFrameId !== null) {
      cancelAnimationFrame(this.dependencyRedrawFrameId);
    }
    this.clearPopupHost();
    this.gantt = null;
  }

  setViewMode(mode: ViewMode): void {
    this.currentViewMode = mode;
    this.currentColumnWidth = null;

    if (this.viewInitialized) {
      this.renderGantt();
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
    const existingScrollHost = container.querySelector('.gantt-container') as HTMLDivElement | null;
    this.pendingScrollLeft = existingScrollHost?.scrollLeft ?? null;
    container.innerHTML = '';
    this.clearPopupHost();

    if (!this.tasks.length) {
      this.gantt = null;
      return;
    }

    const seededColumnWidth = this.currentColumnWidth ?? this.getBaseColumnWidth(this.currentViewMode);
    this.gantt = new Gantt(container, this.tasks, {
      view_mode: this.currentViewMode,
      column_width: seededColumnWidth,
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

    const desiredColumnWidth = this.getDesiredColumnWidth();
    if (desiredColumnWidth !== null && desiredColumnWidth !== seededColumnWidth) {
      this.currentColumnWidth = desiredColumnWidth;
      this.renderGantt();
      return;
    }

    this.attachCustomDependencyHooks();
    this.attachPopupToOverlay();
    this.scheduleDependencyRedraw();
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
    this.restoreScrollPosition();
    this.scheduleDependencyRedraw();
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

  private restoreScrollPosition(): void {
    const scrollHost = this.container.nativeElement.querySelector(
      '.gantt-container',
    ) as HTMLDivElement | null;

    if (!scrollHost) {
      return;
    }

    if (this.pendingScrollLeft !== null) {
      scrollHost.scrollLeft = this.pendingScrollLeft;
      this.pendingScrollLeft = null;
      return;
    }

    this.gantt.scroll_current?.();
  }

  private drawCustomDependencies(): void {
    const svg = this.container.nativeElement.querySelector('svg.gantt') as SVGSVGElement | null;
    if (!svg) {
      return;
    }

    svg.querySelector('.arrow')?.setAttribute('display', 'none');
    svg.querySelector('.custom-dependencies')?.remove();
    this.ensureCustomArrowMarker(svg);

    const layer = document.createElementNS(this.svgNs, 'g');
    layer.setAttribute('class', 'custom-dependencies');
    svg.appendChild(layer);

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
  }

  private scheduleDependencyRedraw(): void {
    if (this.dependencyRedrawTimeoutId !== null) {
      clearTimeout(this.dependencyRedrawTimeoutId);
    }
    if (this.dependencyRedrawFrameId !== null) {
      cancelAnimationFrame(this.dependencyRedrawFrameId);
    }

    this.waitForStableBars();

    this.dependencyRedrawTimeoutId = setTimeout(() => {
      this.dependencyRedrawTimeoutId = null;
      this.drawCustomDependencies();
    }, 320);
  }

  private waitForStableBars(
    previousSnapshot: string | null = null,
    stableFrames = 0,
    remainingFrames = 18,
  ): void {
    this.dependencyRedrawFrameId = requestAnimationFrame(() => {
      const snapshot = this.captureBarGeometrySnapshot();

      if (!snapshot) {
        this.dependencyRedrawFrameId = null;
        return;
      }

      const nextStableFrames = snapshot === previousSnapshot ? stableFrames + 1 : 0;
      if (nextStableFrames >= 2 || remainingFrames <= 0) {
        this.dependencyRedrawFrameId = null;
        this.drawCustomDependencies();
        return;
      }

      this.waitForStableBars(snapshot, nextStableFrames, remainingFrames - 1);
    });
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

  private attachCustomDependencyHooks(): void {
    if (!this.gantt) {
      return;
    }

    const originalRender = this.gantt.render?.bind(this.gantt);
    if (originalRender && !this.gantt.__customDependencyRenderPatched) {
      this.gantt.render = (...args: unknown[]) => {
        const result = originalRender(...args);
        this.scheduleDependencyRedraw();
        return result;
      };
      this.gantt.__customDependencyRenderPatched = true;
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
