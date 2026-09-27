import { type Priority, type Task, tasks } from '@/data/tasks';
import type { BadgeTone } from '@/ui';

export type ListName = 'sprint' | 'backlog';

export interface BoardTask extends Task {
	list: ListName;
}

export const PRIORITIES: Readonly<Record<Priority, { label: string; tone: BadgeTone }>> = {
	urgent: { label: 'Urgent', tone: 'red' },
	high: { label: 'High', tone: 'amber' },
	medium: { label: 'Medium', tone: 'blue' },
	low: { label: 'Low', tone: 'gray' },
};

export const SPRINT_CAPACITY = 28;

export function createBoard(): BoardTask[] {
	return tasks.map(task => ({ ...task, list: task.status === 'todo' ? 'backlog' : 'sprint' }));
}
