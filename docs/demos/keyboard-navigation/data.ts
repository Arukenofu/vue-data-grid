export type BuildStatus = 'passed' | 'failed' | 'running';

export interface Release {
	id: string;
	version: string;
	service: string;
	author: string;
	status: BuildStatus;
	approved: boolean;
}

export const releases: readonly Release[] = [
	{ id: 'r1', version: 'v4.2.0', service: 'checkout', author: 'Mia Tanaka', status: 'passed', approved: true },
	{ id: 'r2', version: 'v4.1.3', service: 'search', author: 'Omar Haddad', status: 'failed', approved: false },
	{ id: 'r3', version: 'v2.8.1', service: 'billing', author: 'Nora Berg', status: 'passed', approved: false },
	{ id: 'r4', version: 'v1.14.0', service: 'notifications', author: 'Kai Walsh', status: 'running', approved: false },
	{ id: 'r5', version: 'v3.0.0', service: 'accounts', author: 'Aria Meyer', status: 'passed', approved: true },
	{ id: 'r6', version: 'v0.9.7', service: 'reports', author: 'Ivan Petrova', status: 'passed', approved: false },
	{ id: 'r7', version: 'v5.6.2', service: 'gateway', author: 'Zoe Silva', status: 'failed', approved: false },
	{ id: 'r8', version: 'v2.2.4', service: 'media', author: 'Theo Novak', status: 'running', approved: false },
	{ id: 'r9', version: 'v1.3.9', service: 'pricing', author: 'Lena Dubois', status: 'passed', approved: true },
	{ id: 'r10', version: 'v7.0.1', service: 'auth', author: 'Hugo Kim', status: 'passed', approved: false },
];
