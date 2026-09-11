import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  type CourseId,
  courses,
  resolveCourseFromLocation,
  buildCourseHref,
} from '../src/lib/courses';
import { orderLanguages } from '../src/lib/languages';
import App from '../src/App';
import { CourseSwitcher } from '../src/components/CourseSwitcher';
import { makeSpanishWord } from './fixtures';

describe('course meaning columns', () => {
  test('a course never offers the language it teaches', () => {
    const spanishCodes = courses.spanish.translationLanguages.map(
      (language) => language.code,
    );
    const frenchCodes = courses.french.translationLanguages.map(
      (language) => language.code,
    );
    expect(spanishCodes).not.toContain('es');
    expect(spanishCodes).toContain('fr');
    expect(frenchCodes).not.toContain('fr');
    expect(frenchCodes).toContain('es');
  });

  test('French survives a round trip through the registry order', () => {
    // it used to be offered by the spanish course but missing from the registry, so a
    // reader who picked it lost the column again on the next load
    expect(orderLanguages(['en', 'fa', 'fr'])).toEqual(['en', 'fa', 'fr']);
  });
});

describe('spanish course rendering', () => {
  const words = [makeSpanishWord(1), makeSpanishWord(2)];

  test('names the course in the search box and the empty state', async () => {
    const user = userEvent.setup();
    render(<App initialWords={words} initialCourseId="spanish" />);

    expect(
      screen.getByPlaceholderText('Spanish, English, Persian, or example'),
    ).toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: /Search the list/ });
    await user.type(search, 'not-in-the-list');
    expect(screen.getByRole('status')).toHaveTextContent('Spanish word');
  });

  test('labels the controls with the Spanish headword, not undefined', () => {
    render(<App initialWords={words} initialCourseId="spanish" />);

    expect(
      screen.getByRole('button', {
        name: 'Play pronunciation of palabra1',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Star palabra1' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add palabra1 to a list' }),
    ).toBeInTheDocument();
  });
});

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
