import { type CourseId, courseList, buildCourseHref } from '../lib/courses';

type CourseSwitcherProps = {
  currentCourseId: CourseId;
  onSelectCourse: (courseId: CourseId) => void;
};

export function CourseSwitcher({
  currentCourseId,
  onSelectCourse,
}: CourseSwitcherProps) {
  return (
    <nav className="course-switcher" aria-label="Available vocabulary courses">
      <ul className="course-switcher-list">
        {courseList.map((course) => {
          const isActive = course.id === currentCourseId;
          const href = buildCourseHref(course.id);
          return (
            <li key={course.id} className="course-switcher-item">
              <a
                href={href}
                className={`course-switcher-button ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  if (!isActive) {
                    onSelectCourse(course.id);
                  }
                }}
              >
                <span className="course-name">{course.name}</span>{' '}
                <span className="course-badge">1000</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
