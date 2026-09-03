import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  type CourseId,
  courses,
  resolveCourseFromLocation,
  buildCourseHref,
} from '../src/lib/courses';
import { CourseSwitcher } from '../src/components/CourseSwitcher';

describe('courses and routing', () => {
  test('resolves course from pathname correctly', () => {
    expect(resolveCourseFromLocation('/spanish-1000')).toBe('spanish');
    expect(resolveCourseFromLocation('/repo/spanish-1000/')).toBe('spanish');
    expect(resolveCourseFromLocation('/french-1000')).toBe('french');
    expect(resolveCourseFromLocation('/')).toBe('french');
  });

  test('resolves course from hash correctly', () => {
    expect(resolveCourseFromLocation('/', '#/spanish-1000')).toBe('spanish');
    expect(resolveCourseFromLocation('/', '#/french-1000')).toBe('french');
  });

  test('resolves course from search query correctly', () => {
    expect(resolveCourseFromLocation('/', '', '?lang=spanish')).toBe('spanish');
    expect(resolveCourseFromLocation('/', '', '?lang=es')).toBe('spanish');
    expect(resolveCourseFromLocation('/', '', '?lang=french')).toBe('french');
  });

  test('buildCourseHref produces expected paths', () => {
    expect(courses.spanish.slug).toBe('spanish-1000');
    expect(courses.french.slug).toBe('french-1000');
    expect(buildCourseHref('spanish')).toContain('spanish-1000');
  });

  test('CourseSwitcher highlights active course and responds to click', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn<(courseId: CourseId) => void>();

    render(
      <CourseSwitcher currentCourseId="french" onSelectCourse={handleSelect} />,
    );

    const frenchBtn = screen.getByRole('link', { name: /French 1000/ });
    const spanishBtn = screen.getByRole('link', { name: /Spanish 1000/ });

    expect(frenchBtn).toHaveClass('active');
    expect(spanishBtn).not.toHaveClass('active');

    await user.click(spanishBtn);
    expect(handleSelect).toHaveBeenCalledWith('spanish');
  });
});
