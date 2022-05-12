import { Algorithm, Move, World } from '../world';

class CustomAlgorithm {

	constructor(public world: World) { }

	*execute(): Algorithm {
		const moveJson = window.prompt('Input a move sequence (as a JSON array containing moves of the form [x1, y1, z1, x2, y2, z2]):')!;
		let sequence: any;
		try {
			sequence = JSON.parse(moveJson);
		} catch (e) {
			throw new Error('JSON string was invalid');
		}

		printStep(`Running custom move sequence`);

		for (let move of sequence) {
			const square = this.world.getSquare([move[0], move[1], move[2]]);
			if (!square) {
				throw new Error("Custom move path tried to move a non-existing square at " +
					`(${move[0]}, ${move[1]}, ${move[2]})`);
			}
			if (this.world.hasSquare([move[3], move[4], move[5]])) {
				throw new Error("Custom move path tried to move a square on top of another square at " +
					`(${move[3]}, ${move[4]}, ${move[5]})`);
			}
			const m = this.world.getMoveTo(square, [move[3], move[4], move[5]]);
			if (m === null) {
				throw new Error("Custom move path tried to do a move that is invalid in the sliding cube model: " +
					`(${move[0]}, ${move[1]}, ${move[2]}) \u2192 (${move[3]}, ${move[4]}, ${move[5]})`);
			}
			yield m;
		}

		printStep("Move sequence finished");
	}
}

export { CustomAlgorithm };
