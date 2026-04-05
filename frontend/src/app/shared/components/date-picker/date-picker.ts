import {
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  forwardRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type CalendarCell = {
  date: Date;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  key: string;
};

type PickerView = 'day' | 'month' | 'year';

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePicker),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatePicker implements ControlValueAccessor {
  @Input() inputId = '';
  @Input() placeholder = 'MM/DD/YYYY';

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly displayFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  private readonly monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  });

  protected readonly weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  protected readonly monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  protected isOpen = false;
  protected isDisabled = false;
  protected selectedDate: Date | null = null;
  protected viewDate = this.startOfMonth(new Date());
  protected currentView: PickerView = 'day';

  private onChange: (value: Date | null) => void = () => {};
  private onTouched: () => void = () => {};

  get displayValue(): string {
    return this.selectedDate ? this.displayFormatter.format(this.selectedDate) : '';
  }

  get monthLabel(): string {
    return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(this.viewDate);
  }

  get yearLabel(): string {
    return String(this.viewDate.getFullYear());
  }

  get yearRangeLabel(): string {
    const start = this.yearRangeStart;
    return `${start} - ${start + 11}`;
  }

  get calendarCells(): CalendarCell[] {
    const firstOfMonth = this.startOfMonth(this.viewDate);
    const startOffset = firstOfMonth.getDay();
    const gridStart = this.addDays(firstOfMonth, -startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = this.addDays(gridStart, index);
      return {
        date,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === this.viewDate.getMonth(),
        isToday: this.isSameDate(date, new Date()),
        key: this.toKey(date),
      };
    });
  }

  get yearRangeStart(): number {
    const year = this.viewDate.getFullYear();
    return year - (year % 12);
  }

  get yearCells(): number[] {
    const start = this.yearRangeStart;
    return Array.from({ length: 12 }, (_, index) => start + index);
  }

  writeValue(value: Date | string | null): void {
    this.selectedDate = this.normalizeDate(value);
    this.viewDate = this.startOfMonth(this.selectedDate ?? new Date());
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    if (isDisabled) {
      this.isOpen = false;
    }
    this.cdr.markForCheck();
  }

  protected toggleCalendar(): void {
    if (this.isDisabled) return;
    this.isOpen ? this.closeCalendar() : this.openCalendar();
  }

  protected openCalendar(): void {
    if (this.isDisabled) return;
    this.isOpen = true;
    this.currentView = 'day';
    this.viewDate = this.startOfMonth(this.selectedDate ?? new Date());
  }

  protected closeCalendar(markTouched = true): void {
    this.isOpen = false;
    if (markTouched) {
      this.onTouched();
    }
  }

  protected previousMonth(): void {
    if (this.currentView === 'day') {
      this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
      return;
    }

    if (this.currentView === 'month') {
      this.viewDate = new Date(this.viewDate.getFullYear() - 1, this.viewDate.getMonth(), 1);
      return;
    }

    this.viewDate = new Date(this.viewDate.getFullYear() - 12, this.viewDate.getMonth(), 1);
  }

  protected nextMonth(): void {
    if (this.currentView === 'day') {
      this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
      return;
    }

    if (this.currentView === 'month') {
      this.viewDate = new Date(this.viewDate.getFullYear() + 1, this.viewDate.getMonth(), 1);
      return;
    }

    this.viewDate = new Date(this.viewDate.getFullYear() + 12, this.viewDate.getMonth(), 1);
  }

  protected selectDate(date: Date): void {
    const normalized = this.normalizeDate(date);
    this.selectedDate = normalized;
    this.onChange(normalized);
    this.closeCalendar();
  }

  protected clearDate(): void {
    this.selectedDate = null;
    this.onChange(null);
    this.closeCalendar();
  }

  protected showMonthView(): void {
    this.currentView = 'month';
  }

  protected showYearView(): void {
    this.currentView = 'year';
  }

  protected selectMonth(monthIndex: number): void {
    this.viewDate = new Date(this.viewDate.getFullYear(), monthIndex, 1);
    this.currentView = 'day';
  }

  protected selectYear(year: number): void {
    this.viewDate = new Date(year, this.viewDate.getMonth(), 1);
    this.currentView = 'month';
  }

  protected isActiveMonth(monthIndex: number): boolean {
    return this.viewDate.getMonth() === monthIndex;
  }

  protected isActiveYear(year: number): boolean {
    return this.viewDate.getFullYear() === year;
  }

  protected isSelected(date: Date): boolean {
    return this.isSameDate(date, this.selectedDate);
  }

  @HostListener('document:mousedown', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeCalendar();
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.isOpen) {
      this.closeCalendar();
    }
  }

  private normalizeDate(value: Date | string | null): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map((part) => Number(part));
      return new Date(year, month - 1, day);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private isSameDate(a: Date | null, b: Date | null): boolean {
    return !!a && !!b && this.toKey(a) === this.toKey(b);
  }

  private toKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
