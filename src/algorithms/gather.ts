import { World, } from '../world';
import {Cube, ComponentStatus, Position} from '../cube';
import { Vector } from '../vector';
import { Algorithm } from './algorithm';
import {MoveGenerator} from "../move";

class GatherAlgorithm extends Algorithm {
    
    constructor(public world: World) {
        super(world);
    }

    override *execute() : MoveGenerator {
        printStep('Gathering');
        const limit = this.configuration.boundingBoxSpan();
        
        const root = this.configuration.cubes[0];
        
        let lightCube = this.findLightCube(limit, root);
        while (!this.configuration.isXYZMonotone() && lightCube !== null) {
            printMiniStep(`Gathering light Cube (${lightCube.p[0]}, ${lightCube.p[1]}, ${lightCube.p[2]})`)

            const target = this.findGatherTarget(lightCube);
            const leaf = this.findLeafInDescendants(lightCube, root);
            if (leaf === null) {
                break;
            }
            
            yield* this.walkBoundaryUntil(leaf, lightCube, target);
            
            this.configuration.markComponents();
            lightCube = this.findLightCube(limit, root);
        }
    }

    /**
     * Finds a light Cube closest to the first Cube in the Cubes array, 
     * or null if there are no light Cubes in the configuration.
     * This assumes that the component status of the cubes has been set properly.
     */
    findLightCube(limit: number, r: Cube): Cube | null {
        let heaviestLightCube = null;
        let heaviestLightCubeCapacity = 0;
        
        for (let i = 0; i < this.configuration.cubes.length; i++) {
            const cube = this.configuration.cubes[i];
            if (cube.componentStatus === ComponentStatus.CONNECTOR || 
                    cube.componentStatus === ComponentStatus.LINK_CUT) {
                const capacity = this.configuration.capacity(cube, r);
                if (capacity < limit && capacity > heaviestLightCubeCapacity) {
                    heaviestLightCubeCapacity = capacity;
                    heaviestLightCube = cube;
                }
            }
        }
        
        return heaviestLightCube;
    }

    /**
     * Given a light Cube s, returns a neighboring empty cell n of s such that the following holds:
     * 
     * * n is a diagonal neighbor of s, and the two cells neighboring both n and s are filled by Cubes
     *  or else
     * * n is a direct neighbor of s and n lies within the bounding box
     */
    findGatherTarget(s: Cube) : Position {
        // first check all corners
        const has = this.configuration.hasNeighbors([s.p[0], s.p[1], s.p[2]]);
        let [x, y, z] = s.p;
        
        // if this square is part of a corner, return the fourth position that closes the chunk.
        if (has['x'] && has['y'] && !this.configuration.hasCube([x - 1, y - 1, z])) return [x - 1, y - 1, z];
        if (has['x'] && has['Y'] && !this.configuration.hasCube([x - 1, y + 1, z])) return [x - 1, y + 1, z];
        if (has['x'] && has['z'] && !this.configuration.hasCube([x - 1, y, z - 1])) return [x - 1, y, z - 1];
        if (has['x'] && has['Z'] && !this.configuration.hasCube([x - 1, y, z + 1])) return [x - 1, y, z + 1];
        if (has['X'] && has['y'] && !this.configuration.hasCube([x + 1, y - 1, z])) return [x + 1, y - 1, z];
        if (has['X'] && has['Y'] && !this.configuration.hasCube([x + 1, y + 1, z])) return [x + 1, y + 1, z];
        if (has['X'] && has['z'] && !this.configuration.hasCube([x + 1, y, z - 1])) return [x + 1, y, z - 1];
        if (has['X'] && has['Z'] && !this.configuration.hasCube([x + 1, y, z + 1])) return [x + 1, y, z + 1];
        if (has['y'] && has['z'] && !this.configuration.hasCube([x, y - 1, z - 1])) return [x, y - 1, z - 1];
        if (has['y'] && has['Z'] && !this.configuration.hasCube([x, y - 1, z + 1])) return [x, y - 1, z + 1];
        if (has['Y'] && has['z'] && !this.configuration.hasCube([x, y + 1, z - 1])) return [x, y + 1, z - 1];
        if (has['Y'] && has['Z'] && !this.configuration.hasCube([x, y + 1, z + 1])) return [x, y + 1, z + 1];
        
        // check all sides, we already know that there are no corners.
        // only return the side that is within the bounding box
        if (has['x'] && has['X']) {
            let possiblePositions: Position[] = [[x, y, z - 1], [x, y, z + 1], [x, y - 1, z], [x, y + 1, z]];
            for (let p of possiblePositions) {
                if (this.configuration.boundingBoxContains(p)) {
                    return p;
                }
            }
        }
        if (has['y'] && has['Y']) {
            let possiblePositions: Position[] = [ [x, y, z - 1], [x, y, z + 1], [x - 1, y, z], [x + 1, y, z] ];
            for (let p of possiblePositions) {
                if (this.configuration.boundingBoxContains(p)) {
                    return p;
                }
            }
        }
        if (has['z'] && has['Z']) {
            let possiblePositions: Position[] = [ [x - 1, y, z], [x + 1, y, z], [x, y - 1, z], [x, y + 1, z] ];
            for (let p of possiblePositions) {
                if (this.configuration.boundingBoxContains(p)) {
                    return p;
                }
            }
        }
        
        // if we end here, there are no neighbors, so the Cube is disconnected
        throw Error("Cube is disconnected");
    }

    /**
     * Given a light Cube s and a root r, return a Cube from the descendants of s, not
     * edge-adjacent to s itself, that can be safely removed to chunkify s.
     */
    findLeafInDescendants(s: Cube, r: Cube): Cube | null {
        // do a bfs from the root to see which Cubes are on the other side of s
        // do a BFS from the root, counting the Cubes, but disregard s
        
        const capacityCubes = this.configuration.capacityCubes(s, r);
        for (let i = 0; i < capacityCubes.length; i++) {
            // only check Cubes that contribute to the capacity of s
            if (!capacityCubes[i]) continue;
            
            // if the configuration is still connected without this Cube, we can safely remove it
            if (this.configuration.isConnected(this.configuration.cubes[i].p)) {
                return this.configuration.cubes[i];
            }
        }
        return null;
    }

    /**
     * Runs a series of moves to walk a leaf Cube s over the boundary of
     * the configuration to end up at the given empty target cell.
     * It tries to find a shortest path over only the Cubes
     * contributing to the capacity of the corresponding light Cube l.
     * One of three situations might occur:
     * * This path exists and is also valid when considering the complete configuration:
     *      In this case, just follow this path
     * * This path exists, but is not valid when considering the complete configuration:
     *      The path is blocked by a cube not in the capacity of l.
     *      Just move as far along the path as possible.
     *      This closes a cycle that contains l, which makes l not light anymore.
     * * This path does not exist.
     *      In this case, leaf Cube s is blocked by its own ancestors.
     *      Move s to a position that closes a cycle, such that we can make progress.
     */
    *walkBoundaryUntil(s: Cube, l: Cube, target: [number, number, number]): MoveGenerator {
        try {
            yield* this.configuration.shortestMovePath(s.p, target);
        } catch (e) {
            // TODO no path available, so go as far as possible and close a cycle.
            throw e;
        }
    }
    
}

export { GatherAlgorithm }