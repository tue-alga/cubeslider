import { MoveGenerator, World, Move} from '../world';
import {Square, ComponentStatus, Position} from '../square';
import { Vector } from '../vector';
import { Algorithm } from './algorithm';

class GatherAlgorithm extends Algorithm {
    
    constructor(public world: World) {
        super(world);
    }

    override *execute() : MoveGenerator {
        printStep('Gathering');
        const limit = this.world.boundingBoxSpan();
        
        const root = this.world.squares[0];
        
        let lightSquare = this.findLightSquare(limit, root);
        while (!this.world.isXYZMonotone() && lightSquare !== null) {
            printMiniStep(`Gathering light square (${lightSquare.p[0]}, ${lightSquare.p[1]}, ${lightSquare.p[2]})`)
            
            const target = this.findGatherTarget(lightSquare);
            const leaf = this.findLeafInDescendants(lightSquare, root);
            if (leaf === null) {
                break;
            }

            yield* this.walkBoundaryUntil(leaf, target);

            lightSquare = this.findLightSquare(limit, root);
        }
    }

    /**
     * Finds a light square closest to the first square in the squares array, 
     * or null if there are no light squares in the configuration
     */
    findLightSquare(limit: number, r: Square): Square | null {
        let heaviestLightSquare = null;
        let heaviestLightSquareCapacity = 0;
        
        for (let i = 0; i < this.world.squares.length; i++) {
            const square = this.world.squares[i];
            if (square.componentStatus === ComponentStatus.CONNECTOR || 
                    square.componentStatus === ComponentStatus.LINK_CUT) {
                const capacity = this.world.capacity(square, r);
                if (capacity < limit && capacity > heaviestLightSquareCapacity) {
                    heaviestLightSquareCapacity = capacity;
                    heaviestLightSquare = square;
                }
            }
        }
        
        return heaviestLightSquare;
    }

    /**
     * Given a light square s, returns a neighboring empty cell n of s such that the following holds:
     * 
     * * n is a diagonal neighbor of s, and the two cells neighboring both n and s are filled by squares
     *  or else
     * * n is a direct neighbor of s
     */
    findGatherTarget(s: Square) : Position {
        // first check all corners
        const has = this.world.hasNeighbors([s.p[0], s.p[1], s.p[2]]);
        let [x, y, z] = s.p;
        
        // All z-1 positions are evaluated last, since this might make the square dip below the
        // guideline plane. This is undesired for visual reasons.
        if (has['x'] && has['y']) return [x - 1, y - 1, z];
        if (has['x'] && has['Y']) return [x - 1, y + 1, z];
        if (has['x'] && has['Z']) return [x - 1, y, z + 1];
        if (has['X'] && has['y']) return [x + 1, y - 1, z];
        if (has['X'] && has['Y']) return [x + 1, y + 1, z];
        if (has['X'] && has['Z']) return [x + 1, y, z + 1];
        if (has['y'] && has['Z']) return [x, y - 1, z + 1];
        if (has['Y'] && has['Z']) return [x, y + 1, z + 1];
        if (has['x'] && has['z']) return [x - 1, y, z - 1];
        if (has['X'] && has['z']) return [x + 1, y, z - 1];
        if (has['y'] && has['z']) return [x, y - 1, z - 1];
        if (has['Y'] && has['z']) return [x, y + 1, z - 1];
        
        // check all sides, we already know that there are no corners
        if (has['x'] || has['X'] || has['y'] || has['Y']) return [x, y, z - 1];
        if (has['z'] || has['Z']) return [x - 1, y, z];
        
        // if we end here, there are no neighbors, so the square is disconnected
        throw Error("Square is disconnected");
    }

    /**
     * Given a light square s and a root r, return a square from the descendants of s, not
     * edge-adjacent to s itself, that can be safely removed to chunkify s.
     */
    findLeafInDescendants(s: Square, r: Square): Square | null {
        // do a bfs from the root to see which squares are on the other side of s
        // do a BFS from the root, counting the squares, but disregard s
        
        const capacitySquares = this.world.capacitySquares(s, r);
        for (let i = 0; i < capacitySquares.length; i++) {
            // only check squares that contribute to the capacity of s
            if (!capacitySquares[i]) continue;
            
            // if the configuration is still connected without this square, we can safely remove it
            if (this.world.isConnected(this.world.squares[i].p)) {
                return this.world.squares[i];
            }
        }
        return null;
    }

    /**
     * Runs a series of moves to walk a square s over the boundary of
     * the configuration to end up at the given empty target cell,
     * in such a way that it does not pass the origin.
     */
    *walkBoundaryUntil(s: Square, target: [number, number, number]): MoveGenerator {
        try {
            yield* this.world.shortestMovePath(s.p, target);
        } catch (e) {
            // TODO no path available, so go as far as possible and close a cycle.
            throw e;
        }
    }
    
}

export { GatherAlgorithm }