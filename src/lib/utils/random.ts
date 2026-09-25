export class PRNG {
	private seed: number;

	constructor(seed: number) {
		const safeSeed = Number.isFinite(seed) ? Math.trunc(seed) : 0;
		this.seed = this.splitmix32(safeSeed)();
	}

	private splitmix32(a: number) {
		return function () {
			a |= 0;
			a = (a + 0x9e3779b9) | 0;
			let t = a ^ (a >>> 16);
			t = Math.imul(t, 0x21f0aaad);
			t = t ^ (t >>> 15);
			t = Math.imul(t, 0x735a2d97);
			return ((t = t ^ (t >>> 15)) >>> 0);
		};
	}

	// Mulberry32 for faster generation after seeding
	private mulberry32() {
		let t = (this.seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	public nextFloat(): number {
		return this.mulberry32();
	}

	// Returns an integer between min (inclusive) and max (exclusive)
	public nextInt(min: number, max: number): number {
		const safeMin = Number.isFinite(min) ? Math.trunc(min) : 0;
		const safeMax = Number.isFinite(max) ? Math.trunc(max) : safeMin;
		if (safeMax <= safeMin) return safeMin;
		return Math.floor(this.nextFloat() * (safeMax - safeMin)) + safeMin;
	}

	// Fisher-Yates shuffle
	public shuffle<T>(array: T[]): T[] {
		const result = [...array];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(this.nextFloat() * (i + 1));
			[result[i], result[j]] = [result[j], result[i]];
		}
		return result;
	}
}
