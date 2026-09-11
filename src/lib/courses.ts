import {
  type LanguageCode,
  type LanguageDefinition,
  languages,
} from './languages';

export type CourseId = 'french' | 'spanish';

export type CourseConfig = {
  id: CourseId;
  slug: string;
  name: string;
  code: string;
  speechLang: string;
  eyebrow: string;
  title: string;
  intro: string;
  footerText: string;
  storageKeys: {
    practice: string;
    collections: string;
    languages: string;
  };
  translationLanguages: LanguageDefinition[];
};

// a course never offers its own language as a meaning column, so each list is the
// registry minus the language being taught
function translationLanguagesFor(code: LanguageCode): LanguageDefinition[] {
  return languages.filter((language) => language.code !== code);
}

export const courses: Record<CourseId, CourseConfig> = {
  french: {
    id: 'french',
    slug: 'french-1000',
    name: 'French',
    code: 'fr',
    speechLang: 'fr-FR',
    eyebrow: 'A beginner’s working vocabulary',
    title: 'French 1000',
    intro:
      'One thousand useful French words in the supplied order, with clear English and Persian meanings, a short example, and pronunciation.',
    footerText: 'Built for focused, everyday French practice.',
    storageKeys: {
      practice: 'french-1000:practice',
      collections: 'french-1000:collections',
      languages: 'french-1000:languages',
    },
    translationLanguages: translationLanguagesFor('fr'),
  },
  spanish: {
    id: 'spanish',
    slug: 'spanish-1000',
    name: 'Spanish',
    code: 'es',
    speechLang: 'es-ES',
    eyebrow: 'A beginner’s working vocabulary',
    title: 'Spanish 1000',
    intro:
      'One thousand useful Spanish words in the supplied order, with clear English and Persian meanings, a short example, and pronunciation.',
    footerText: 'Built for focused, everyday Spanish practice.',
    storageKeys: {
      practice: 'spanish-1000:practice',
      collections: 'spanish-1000:collections',
      languages: 'spanish-1000:languages',
    },
    translationLanguages: translationLanguagesFor('es'),
  },
};

export const courseList = Object.values(courses);

// we inspect the pathname first, then the hash or search query so static deep links
// and hash routing work on any host without configuration
export function resolveCourseFromLocation(
  pathname = typeof window !== 'undefined' ? window.location.pathname : '',
  hash = typeof window !== 'undefined' ? window.location.hash : '',
  search = typeof window !== 'undefined' ? window.location.search : '',
): CourseId {
  const combined = `${pathname} ${hash} ${search}`.toLowerCase();
  if (
    combined.includes('spanish-1000') ||
    combined.includes('lang=spanish') ||
    combined.includes('lang=es')
  ) {
    return 'spanish';
  }
  return 'french';
}

export function buildCourseHref(courseId: CourseId): string {
  const targetSlug = courses[courseId].slug;
  if (typeof window === 'undefined') return `/${targetSlug}`;

  const currentPath = window.location.pathname;
  // if we are already under a subpath like /repo/french-1000 we swap the slug in place
  if (currentPath.includes('french-1000')) {
    return currentPath.replace(/french-1000\/?$/, targetSlug);
  }
  if (currentPath.includes('spanish-1000')) {
    return currentPath.replace(/spanish-1000\/?$/, targetSlug);
  }
  // otherwise we preserve the base and append the slug
  const base = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
  return `${base}${targetSlug}`;
}

export function navigateToCourse(courseId: CourseId): void {
  if (typeof window === 'undefined') return;

  const nextHref = buildCourseHref(courseId);
  try {
    window.history.pushState({ courseId }, '', nextHref);
  } catch {
    // some sandboxes block pushState so we fall back to hash navigation
    window.location.hash = `#/${courses[courseId].slug}`;
  }

  window.dispatchEvent(
    new CustomEvent('coursechange', { detail: { courseId } }),
  );
}

export function subscribeToCourseChange(
  callback: (courseId: CourseId) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleLocation = () => {
    callback(resolveCourseFromLocation());
  };

  const handleCustom = (event: Event) => {
    const custom = event as CustomEvent<{ courseId: CourseId }>;
    if (custom.detail?.courseId) {
      callback(custom.detail.courseId);
    } else {
      handleLocation();
    }
  };

  window.addEventListener('popstate', handleLocation);
  window.addEventListener('hashchange', handleLocation);
  window.addEventListener('coursechange', handleCustom);

  return () => {
    window.removeEventListener('popstate', handleLocation);
    window.removeEventListener('hashchange', handleLocation);
    window.removeEventListener('coursechange', handleCustom);
  };
}
