import {Position} from "./cube";
import {Configuration} from "./configuration";

/**
 * An generator of moves.
 */
type MoveGenerator = Generator<Move, void, undefined>;

/**
 * Possible moves (slides and convex transitions). Slides are represented by
 * a single letter (x, y, or z), which is lowercase for the negative direction
 * and uppercase for the positive direction. Convex transitions are represented
 * similarly, but by a string of length two.
 */
const moveDirections = [
    'x', 'y', 'z', 'X', 'Y', 'Z',
    'xy', 'xY', 'xz', 'xZ',
    'yx', 'yX', 'yz', 'yZ',
    'zx', 'zX', 'zy', 'zY',
    'Xy', 'XY', 'Xz', 'XZ',
    'Yx', 'YX', 'Yz', 'YZ',
    'Zx', 'ZX', 'Zy', 'ZY'
];

/**
 * Representation of a single cube move (either slide or corner).
 */
class Move {
    /**
     * Creates a move from a starting position and a direction.
     */
    constructor(public configuration: Configuration, public position: Position, public direction: string) {
        if (!moveDirections.includes(direction)) {
            throw new Error('Tried to create move with invalid direction "' + direction + '"');
        }
    }

    /**
     * Returns the coordinate of the cell we're moving from.
     */
    sourcePosition(): [number, number, number] {
        return this.position;
    }

    private static targetPositionFromFields(position: Position, direction: string): Position {
        let [x, y, z] = [...position];
        for (let i = 0; i < direction.length; i++) {
            switch (direction[i]) {
                case "x":
                    x--;
                    break;
                case "X":
                    x++;
                    break;
                case "y":
                    y--;
                    break;
                case "Y":
                    y++;
                    break;
                case "z":
                    z--;
                    break;
                case "Z":
                    z++;
                    break;
            }
        }
        return [x, y, z];
    }

    /**
     * Returns the coordinate of the cell we're moving towards.
     */
    targetPosition(): Position {
        return Move.targetPositionFromFields(this.position, this.direction);
    }

    /**
     * Checks if this move is valid, but ignores the connectivity requirement
     * (i.e., still returns true if this move disconnects the configuration
     * but otherwise is valid).
     *
     * This avoids the need to do a BFS to check connectivity.
     */
    isValidIgnoreConnectivity(): boolean {
        if (this.configuration.getCube(this.targetPosition())) {
            return false;
        }

        let has = this.configuration.hasNeighbors(this.position);

        switch (this.direction) {
            case "x":
                return (
                    (has['y'] && has['xy']) ||
                    (has['Y'] && has['xY']) ||
                    (has['z'] && has['xz']) ||
                    (has['Z'] && has['xZ'])
                );
            case "X":
                return (
                    (has['y'] && has['Xy']) ||
                    (has['Y'] && has['XY']) ||
                    (has['z'] && has['Xz']) ||
                    (has['Z'] && has['XZ'])
                );
            case "y":
                return (
                    (has['x'] && has['xy']) ||
                    (has['X'] && has['Xy']) ||
                    (has['z'] && has['yz']) ||
                    (has['Z'] && has['yZ'])
                );
            case "Y":
                return (
                    (has['x'] && has['xY']) ||
                    (has['X'] && has['XY']) ||
                    (has['z'] && has['Yz']) ||
                    (has['Z'] && has['YZ'])
                );
            case "z":
                return (
                    (has['x'] && has['xz']) ||
                    (has['X'] && has['Xz']) ||
                    (has['y'] && has['yz']) ||
                    (has['Y'] && has['Yz'])
                );
            case "Z":
                return (
                    (has['x'] && has['xZ']) ||
                    (has['X'] && has['XZ']) ||
                    (has['y'] && has['yZ']) ||
                    (has['Y'] && has['YZ'])
                );
            default:
                // for corner moves, need to ensure that there is no Cube in
                // the first direction (which would be in our way) and there
                // is a Cube in the second direction (that we can pivot along)
                return !has[this.direction[0]] && has[this.direction[1]];
        }
    }

    /**
     * Checks if this move is valid.
     */
    isValid(): boolean {
        if (!this.isValidIgnoreConnectivity()) {
            return false;
        }
        if (!this.configuration.isConnected([], this.position)) {
            return false;
        }
        return true;
    }

    /**
     * Computes coordinates of a Cube executing this move at the given time
     * between 0 and 1.
     */
    interpolate(time: number): Position {
        time = -2 * time * time * time + 3 * time * time;

        let x: number, y: number, z: number;
        const [x1, y1, z1] = this.sourcePosition();
        const [x2, y2, z2] = this.targetPosition();
        if (this.direction.length === 2) {
            const [xm, ym, zm] = Move.targetPositionFromFields(this.position, this.direction[0]);
            if (time < 0.5) {
                x = x1 + (xm - x1) * 2 * time;
                y = y1 + (ym - y1) * 2 * time;
                z = z1 + (zm - z1) * 2 * time;
            } else {
                x = xm + (x2 - xm) * (2 * time - 1);
                y = ym + (y2 - ym) * (2 * time - 1);
                z = zm + (z2 - zm) * (2 * time - 1);
            }
        } else {
            x = x1 + (x2 - x1) * time;
            y = y1 + (y2 - y1) * time;
            z = z1 + (z2 - z1) * time;
        }

        return [x, y, z];
    }

    execute(): void {
        const cube = this.configuration.getCube(this.position);
        if (!cube) {
            throw new Error(`Tried to move non-existing Cube ` +
                `at (${this.position[0]}, ${this.position[1]})`);
        }

        this.configuration.moveCube(cube, this.targetPosition());
    }

    toString(): string {
        const from = this.position;
        const to = this.targetPosition();
        return `(${from[0]}, ${from[1]}, ${from[2]}) \u2192 (${to[0]}, ${to[1]}, ${to[2]})`;
    }
    
    equals(m: Move): boolean {
        return this.position === m.position && this.targetPosition() === m.targetPosition();
    }
    
}

export { Move, MoveGenerator, moveDirections };