import { pathfindingFamily } from './pathfinding/family';
import { adversarialFamily } from './adversarial/family';
import { optimizationFamily, sortingFamily } from './stubs';
import type { ProblemFamily } from './types';
import type { Problem } from '../domain/problem';

/**
 * The family registry: the single place a new algorithm family is added.
 *
 * Order here is the order the family switcher renders, so built families come
 * first and stubs last.
 */
export const families: ProblemFamily[] = [
	pathfindingFamily,
	adversarialFamily,
	optimizationFamily,
	sortingFamily
];

const byId = new Map(families.map((family) => [family.id, family]));

export function getFamily(id: string): ProblemFamily | undefined {
	return byId.get(id);
}

export function readyFamilies(): ProblemFamily[] {
	return families.filter((family) => family.status === 'ready');
}

export function plannedFamilies(): ProblemFamily[] {
	return families.filter((family) => family.status === 'planned');
}

/** The family that owns a problem, or undefined when nothing matches. */
export function familyForProblem(problem: Problem): ProblemFamily | undefined {
	return families.find((family) => family.matchProblem(problem));
}

/** The family an environment type belongs to, or undefined. */
export function familyForEnvironment(
	environmentType: ProblemFamily['environmentTypes'][number]
): ProblemFamily | undefined {
	return families.find((family) => family.environmentTypes.includes(environmentType));
}

/** The default algorithm for a family, which is its first registered one. */
export function defaultAlgorithmId(family: ProblemFamily): string | null {
	return family.algorithms[0] ?? null;
}

export { pathfindingFamily, adversarialFamily, optimizationFamily, sortingFamily };
export * from './types';
