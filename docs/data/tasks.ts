export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
	id: string;
	title: string;
	status: TaskStatus;
	priority: Priority;
	assignee: string;
	estimate: number;
	progress: number;
	due: string;
}

export const tasks: readonly Task[] = [
	{ id: 't1', title: 'Sketch the onboarding flow', status: 'doing', priority: 'high', assignee: 'Mia Tanaka', estimate: 5, progress: 60, due: '2026-10-02' },
	{ id: 't2', title: 'Audit colour contrast', status: 'todo', priority: 'medium', assignee: 'Leo Rossi', estimate: 2, progress: 0, due: '2026-10-06' },
	{ id: 't3', title: 'Migrate billing to the v2 API', status: 'review', priority: 'urgent', assignee: 'Omar Haddad', estimate: 8, progress: 90, due: '2026-09-30' },
	{ id: 't4', title: 'Write the release notes', status: 'todo', priority: 'low', assignee: 'Nora Berg', estimate: 1, progress: 0, due: '2026-10-09' },
	{ id: 't5', title: 'Fix the focus ring in dialogs', status: 'done', priority: 'medium', assignee: 'Kai Walsh', estimate: 1, progress: 100, due: '2026-09-24' },
	{ id: 't6', title: 'Load test the search endpoint', status: 'doing', priority: 'high', assignee: 'Ivan Petrova', estimate: 3, progress: 35, due: '2026-10-01' },
	{ id: 't7', title: 'Interview five churned users', status: 'todo', priority: 'medium', assignee: 'Zoe Silva', estimate: 4, progress: 10, due: '2026-10-12' },
	{ id: 't8', title: 'Ship dark mode for reports', status: 'review', priority: 'medium', assignee: 'Aria Meyer', estimate: 3, progress: 80, due: '2026-10-03' },
	{ id: 't9', title: 'Rotate the API keys', status: 'todo', priority: 'urgent', assignee: 'Theo Novak', estimate: 1, progress: 0, due: '2026-09-29' },
	{ id: 't10', title: 'Refresh the pricing page', status: 'doing', priority: 'low', assignee: 'Lena Dubois', estimate: 2, progress: 50, due: '2026-10-08' },
	{ id: 't11', title: 'Add CSV export to invoices', status: 'done', priority: 'high', assignee: 'Hugo Kim', estimate: 3, progress: 100, due: '2026-09-22' },
	{ id: 't12', title: 'Plan the Q4 roadmap review', status: 'todo', priority: 'high', assignee: 'Sara Okafor', estimate: 2, progress: 5, due: '2026-10-05' },
];
