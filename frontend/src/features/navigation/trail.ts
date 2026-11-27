export type ProfilePage = '/profile' | '/profile/goals' | '/profile/trackers';

/** A page a breadcrumb step can lead back to. */
export type CrumbHref = ProfilePage | '/' | '/workout';

export type Crumb = {
  /** Translation key of the label. */
  label: string;
  /** The page it leads to; the last crumb (the page on screen) has none. */
  href?: CrumbHref;
  /** Set on a tracker's page: the label is the tracker's name once it is known. */
  trackerId?: string;
};

const SECTIONS: Record<string, string> = {
  '': 'tabs.home',
  history: 'tabs.history',
  log: 'tabs.log',
  progress: 'tabs.progress',
};

/**
 * The breadcrumb for a path inside the tabs, as shown in the desktop top bar: the section
 * first, then each page on the way, the current page last ("Profile / Goals / Edit goal").
 * Unknown paths get no breadcrumb.
 */
export function trailFor(pathname: string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean);
  const [section = '', area, page] = parts;
  if (section === 'workout') {
    return workoutTrail(area, parts.length);
  }
  if (section === 'quick-log') {
    return parts.length === 2 ? [{ label: 'tabs.home', href: '/' }, { label: 'nav.quickLog' }] : [];
  }
  if (section !== 'profile') {
    return parts.length <= 1 && section in SECTIONS ? [{ label: SECTIONS[section] }] : [];
  }
  if (!area) {
    return [{ label: 'tabs.profile' }];
  }
  const profile: Crumb = { label: 'tabs.profile', href: '/profile' };
  if (parts.length > 3 || (area !== 'goals' && area !== 'trackers')) {
    return [];
  }
  if (area === 'goals') {
    if (!page) {
      return [profile, { label: 'goals.label' }];
    }
    const goals: Crumb = { label: 'goals.label', href: '/profile/goals' };
    return [profile, goals, { label: page === 'new' ? 'nav.newGoal' : 'nav.editGoal' }];
  }
  if (!page) {
    return [profile, { label: 'trackers.label' }];
  }
  const trackers: Crumb = { label: 'trackers.label', href: '/profile/trackers' };
  return page === 'new'
    ? [profile, trackers, { label: 'nav.newTracker' }]
    : [profile, trackers, { label: 'nav.tracker', trackerId: page }];
}

function workoutTrail(page: string | undefined, depth: number): Crumb[] {
  const home: Crumb = { label: 'tabs.home', href: '/' };
  if (depth === 1) {
    return [home, { label: 'nav.workout' }];
  }
  if (depth > 2) {
    return [];
  }
  if (page === 'add-exercise') {
    return [home, { label: 'nav.workout', href: '/workout' }, { label: 'nav.addExercise' }];
  }
  return page === 'summary' ? [home, { label: 'nav.summary' }] : [];
}

/** "Alex Morgan" -> "Alex M.", for the account chip in the top bar; works for any alphabet. */
export function shortName(name: string): string {
  const [first = '', second] = name.trim().split(/\s+/);
  const initial = second ? Array.from(second)[0].toLocaleUpperCase() : '';
  return initial ? `${first} ${initial}.` : first;
}
