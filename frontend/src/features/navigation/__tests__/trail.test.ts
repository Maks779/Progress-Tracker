import { router } from 'expo-router';

import { openProfilePage } from '../openProfilePage';
import { shortName, trailFor } from '../trail';

jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn(), push: jest.fn() } }));

describe('trailFor', () => {
  it('names the section of a tab page', () => {
    expect(trailFor('/')).toEqual([{ label: 'tabs.home' }]);
    expect(trailFor('/history')).toEqual([{ label: 'tabs.history' }]);
    expect(trailFor('/progress')).toEqual([{ label: 'tabs.progress' }]);
    expect(trailFor('/log')).toEqual([{ label: 'tabs.log' }]);
    expect(trailFor('/profile')).toEqual([{ label: 'tabs.profile' }]);
  });

  it('leads from goal pages back to Profile and Goals', () => {
    const profile = { label: 'tabs.profile', href: '/profile' };
    const goals = { label: 'goals.label', href: '/profile/goals' };
    expect(trailFor('/profile/goals')).toEqual([profile, { label: 'goals.label' }]);
    expect(trailFor('/profile/goals/new')).toEqual([profile, goals, { label: 'nav.newGoal' }]);
    expect(trailFor('/profile/goals/abc')).toEqual([profile, goals, { label: 'nav.editGoal' }]);
  });

  it('leads from tracker pages back to Profile and Trackers, with the tracker to name', () => {
    const profile = { label: 'tabs.profile', href: '/profile' };
    const trackers = { label: 'trackers.label', href: '/profile/trackers' };
    expect(trailFor('/profile/trackers')).toEqual([profile, { label: 'trackers.label' }]);
    expect(trailFor('/profile/trackers/new')).toEqual([profile, trackers, { label: 'nav.newTracker' }]);
    expect(trailFor('/profile/trackers/gym')).toEqual([profile, trackers, { label: 'nav.tracker', trackerId: 'gym' }]);
  });

  it('leads from a session and its edit pages back to History, with the session to name', () => {
    const history = { label: 'tabs.history', href: '/history' };
    const session = { label: 'nav.session', href: '/history/s1', sessionId: 's1' };
    expect(trailFor('/history/s1')).toEqual([history, { label: 'nav.session', sessionId: 's1' }]);
    expect(trailFor('/history/s1/edit')).toEqual([history, session, { label: 'nav.editSession' }]);
    expect(trailFor('/history/s1/add-exercise')).toEqual([
      history,
      session,
      { label: 'nav.editSession', href: '/history/s1/edit' },
      { label: 'nav.addExercise' },
    ]);
  });

  it('leads from a quick log back to Home', () => {
    expect(trailFor('/quick-log/abc')).toEqual([{ label: 'tabs.home', href: '/' }, { label: 'nav.quickLog' }]);
    expect(trailFor('/quick-log/abc/more')).toEqual([]);
  });

  it('leads from the workout pages back to Home and the workout', () => {
    const home = { label: 'tabs.home', href: '/' };
    expect(trailFor('/workout')).toEqual([home, { label: 'nav.workout' }]);
    expect(trailFor('/workout/add-exercise')).toEqual([home, { label: 'nav.workout', href: '/workout' }, { label: 'nav.addExercise' }]);
    expect(trailFor('/workout/summary')).toEqual([home, { label: 'nav.summary' }]);
  });

  it('gives unknown paths no breadcrumb', () => {
    expect(trailFor('/nowhere')).toEqual([]);
    expect(trailFor('/workout/abc')).toEqual([]);
    expect(trailFor('/workout/summary/abc')).toEqual([]);
    expect(trailFor('/history/s1/notes')).toEqual([]);
    expect(trailFor('/history/s1/edit/more')).toEqual([]);
    expect(trailFor('/profile/books')).toEqual([]);
    expect(trailFor('/profile/goals/abc/edit')).toEqual([]);
  });
});

describe('shortName', () => {
  it.each([
    ['Alex Morgan', 'Alex M.'],
    ['Alex', 'Alex'],
    ['  Олександр   мороз ', 'Олександр М.'],
    ['Jan Maria Rokita', 'Jan M.'],
    ['Łukasz żak', 'Łukasz Ż.'],
  ])('%s -> %s', (name, expected) => {
    expect(shortName(name)).toBe(expected);
  });
});

describe('openProfilePage', () => {
  const showProfileTab = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('does nothing on the page itself', () => {
    openProfilePage('/profile/goals', '/profile/goals', showProfileTab);
    expect(showProfileTab).not.toHaveBeenCalled();
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('switches to the Profile tab first when another tab is showing', () => {
    openProfilePage('/profile/goals', '/history', showProfileTab);
    expect(showProfileTab).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledWith('/profile');
    expect(router.push).toHaveBeenCalledWith('/profile/goals', { withAnchor: true });
  });

  it('closes the open Profile pages before opening another one', () => {
    openProfilePage('/profile/goals', '/profile/trackers/gym', showProfileTab);
    expect(showProfileTab).not.toHaveBeenCalled();
    expect(router.dismissTo).toHaveBeenCalledWith('/profile');
    expect(router.push).toHaveBeenCalledWith('/profile/goals', { withAnchor: true });
  });

  it('opens Profile itself without pushing anything', () => {
    openProfilePage('/profile', '/', showProfileTab);
    expect(showProfileTab).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledWith('/profile');
    expect(router.push).not.toHaveBeenCalled();
  });
});
