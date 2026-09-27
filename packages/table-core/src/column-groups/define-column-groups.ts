import type { ColumnGroup, ColumnGroupInput } from './column-groups';

export type ColumnGroups<TInput> = {
	readonly [TName in keyof TInput]: TInput[TName] & { name: TName & string };
};

/**
 * Column groups by name: the object key is the group name, and `children` lists columns and nested
 * groups. How groups look is up to the markup; the engine lays them out in `headerGroups`.
 */
export function defineColumnGroups<TInput extends Record<string, ColumnGroupInput>>(
	input: TInput,
): ColumnGroups<TInput> {
	const result: Record<string, ColumnGroup> = {};

	for (const name of Object.keys(input)) {
		result[name] = { ...input[name], name };
	}

	return Object.freeze(result) as unknown as ColumnGroups<TInput>;
}
