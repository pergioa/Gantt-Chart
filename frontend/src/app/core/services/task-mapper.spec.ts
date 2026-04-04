import { TestBed } from '@angular/core/testing';

import { TaskMapper } from './task-mapper';

describe('TaskMapper', () => {
  let service: TaskMapper;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TaskMapper);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
