export class MinHeap<T> {
	private heap: { value: T; priority: number }[] = [];

	constructor(private idFn?: (val: T) => string) {}

	insert(value: T, priority: number): void {
		this.heap.push({ value, priority });
		this.bubbleUp(this.heap.length - 1);
	}

	extractMin(): T | undefined {
		if (this.heap.length === 0) return undefined;
		if (this.heap.length === 1) return this.heap.pop()?.value;

		const min = this.heap[0].value;
		const last = this.heap.pop();
		if (last !== undefined) {
			this.heap[0] = last;
			this.sinkDown(0);
		}
		return min;
	}

	peek(): T | undefined {
		return this.heap[0]?.value;
	}

	isEmpty(): boolean {
		return this.heap.length === 0;
	}

	size(): number {
		return this.heap.length;
	}

	// Used when priority might have decreased (A* updates)
	// We just insert a duplicate with lower priority and rely on visited sets,
	// which is generally faster than finding and decreasing key in a binary heap.

	private bubbleUp(index: number): void {
		const element = this.heap[index];
		while (index > 0) {
			const parentIndex = Math.floor((index - 1) / 2);
			const parent = this.heap[parentIndex];
			if (element.priority >= parent.priority) break;

			this.heap[index] = parent;
			this.heap[parentIndex] = element;
			index = parentIndex;
		}
	}

	private sinkDown(index: number): void {
		const length = this.heap.length;
		const element = this.heap[index];

		while (true) {
			const leftChildIndex = 2 * index + 1;
			const rightChildIndex = 2 * index + 2;
			let leftChild, rightChild;
			let swap = null;

			if (leftChildIndex < length) {
				leftChild = this.heap[leftChildIndex];
				if (leftChild.priority < element.priority) {
					swap = leftChildIndex;
				}
			}

			if (rightChildIndex < length) {
				rightChild = this.heap[rightChildIndex];
				if (
					(swap === null && rightChild.priority < element.priority) ||
					(swap !== null && leftChild && rightChild.priority < leftChild.priority)
				) {
					swap = rightChildIndex;
				}
			}

			if (swap === null) break;

			this.heap[index] = this.heap[swap];
			this.heap[swap] = element;
			index = swap;
		}
	}
}
