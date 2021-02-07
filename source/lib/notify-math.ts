export function isRising(now: number, compareTo: number): boolean {
	return now > compareTo;
}

export function isFalling(now: number, compareTo: number): boolean {
	return now < compareTo;
}

export function isUnequal(now: number, compareTo: number): boolean {
	return now !== compareTo;
}
