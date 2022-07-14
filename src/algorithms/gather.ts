import { World, } from '../world';
import {Cube, ComponentStatus, Position} from '../cube';
import { Algorithm } from './algorithm';
import {MoveGenerator} from "../move";
import {Configuration} from "../configuration";

class GatherAlgorithm extends Algorithm {
    
    constructor(public world: World) {
        super(world);
    }

    override *execute() : MoveGenerator {
        printStep('Gathering');
        const limit = this.configuration.boundingBoxSpan();
        
        let [lightCube, root] = this.findLightCube(limit);
        while (!this.configuration.isXYZMonotone() && lightCube !== null) {
            // if there is a lightCube, there is also a corresponding root
            root = root!;
            printMiniStep(`Gathering light Cube (${lightCube.p[0]}, ${lightCube.p[1]}, ${lightCube.p[2]})`)

            const leaf = this.findLeafInDescendants(lightCube, root);
            if (leaf === null) {
                break;
            }
            const target = this.findGatherTarget(lightCube, leaf);
            
            yield* this.walkBoundaryUntil(leaf, lightCube, root, target);
            
            this.configuration.markComponents();
            [lightCube, root] = this.findLightCube(limit);
        }
    }

    /**
     * Finds a heaviest light cube and its corresponding root, 
     * or null if there are no light Cubes in the configuration.
     * This assumes that the component status of the cubes has been set properly.
     */
    findLightCube(limit: number): [Cube | null, Cube | null] {
        let heaviestLightCube = null;
        let heaviestLightCubeCapacity = 0;
        let heaviestLightCubeRoot = null;
        
        for (let i = 0; i < this.configuration.cubes.length; i++) {
            const cube = this.configuration.cubes[i];
            if (cube.componentStatus === ComponentStatus.CONNECTOR || 
                    cube.componentStatus === ComponentStatus.LINK_CUT) {
                
                let lightestBranchCapacity = Number.MAX_VALUE;
                let lightestBranchRoot = null;
                for (let root of this.configuration.getNeighbors(cube)) {
                    const capacity = this.configuration.capacity(cube, root);
                    if (capacity < lightestBranchCapacity) {
                        lightestBranchCapacity = capacity;
                        lightestBranchRoot = root;
                    }
                }
                if (lightestBranchCapacity < limit && lightestBranchCapacity > heaviestLightCubeCapacity) {
                    heaviestLightCubeCapacity = lightestBranchCapacity;
                    heaviestLightCube = cube;
                    heaviestLightCubeRoot = lightestBranchRoot;
                }
            }
        }
        
        return [heaviestLightCube, heaviestLightCubeRoot];
    }

    /**
     * Given a list of positions, return true when position p is a neighbor to at least one of these positions
     */
    nbrInComponent(p: Position, component: Position[]): boolean {
        for (let position of component) {
            if (
                (position[0] === p[0] + 1 && position[1] === p[1] && position[2] === p[2]) ||
                (position[0] === p[0] - 1 && position[1] === p[1] && position[2] === p[2]) ||
                (position[0] === p[0] && position[1] === p[1] + 1 && position[2] === p[2]) ||
                (position[0] === p[0] && position[1] === p[1] - 1&& position[2] === p[2]) ||
                (position[0] === p[0] && position[1] === p[1] && position[2] === p[2] + 1) ||
                (position[0] === p[0] && position[1] === p[1] && position[2] === p[2] - 1)
            ) {
                return true;
            }
        }
        return false;
    }

    /**
     * Given a light cube lightCube, returns a neighboring empty cell n of lightCube
     * such that n is adjacent to the connected component c where cube leaf lies in when removing lightCube,
     * and one of the following holds:
     * 
     * * n is a diagonal neighbor of lightCube, and the two cells neighboring both n and lightCube are filled by cubes
     *  or else
     * * n is a direct neighbor of lightCube and n lies within the bounding box
     */
    findGatherTarget(lightCube: Cube, leaf: Cube) : Position {
        // first check all corners
        const has = this.configuration.hasNeighbors([lightCube.p[0], lightCube.p[1], lightCube.p[2]]);
        let [x, y, z] = lightCube.p;

        const inComponent = this.configuration.connectedComponent(lightCube, leaf);
        const componentPositions: Position[] = [];
        for (let i = 0; i < inComponent.length; i++) {
            if (inComponent[i]) {
                componentPositions.push(this.configuration.cubes[i].p);
            }
        }
        
        // if this square is part of a corner where the fourth position is missing,
        // and the fourth position is also touching the connected component of the leaf square,
        // return that fourth position.
        if (has['x'] && has['y'] && !this.configuration.hasCube([x - 1, y - 1, z]) && this.nbrInComponent([x - 1, y - 1, z], componentPositions)) return [x - 1, y - 1, z];
        if (has['x'] && has['Y'] && !this.configuration.hasCube([x - 1, y + 1, z]) && this.nbrInComponent([x - 1, y + 1, z], componentPositions)) return [x - 1, y + 1, z];
        if (has['x'] && has['z'] && !this.configuration.hasCube([x - 1, y, z - 1]) && this.nbrInComponent([x - 1, y, z - 1], componentPositions)) return [x - 1, y, z - 1];
        if (has['x'] && has['Z'] && !this.configuration.hasCube([x - 1, y, z + 1]) && this.nbrInComponent([x - 1, y, z + 1], componentPositions)) return [x - 1, y, z + 1];
        if (has['X'] && has['y'] && !this.configuration.hasCube([x + 1, y - 1, z]) && this.nbrInComponent([x + 1, y - 1, z], componentPositions)) return [x + 1, y - 1, z];
        if (has['X'] && has['Y'] && !this.configuration.hasCube([x + 1, y + 1, z]) && this.nbrInComponent([x + 1, y + 1, z], componentPositions)) return [x + 1, y + 1, z];
        if (has['X'] && has['z'] && !this.configuration.hasCube([x + 1, y, z - 1]) && this.nbrInComponent([x + 1, y, z - 1], componentPositions)) return [x + 1, y, z - 1];
        if (has['X'] && has['Z'] && !this.configuration.hasCube([x + 1, y, z + 1]) && this.nbrInComponent([x + 1, y, z + 1], componentPositions)) return [x + 1, y, z + 1];
        if (has['y'] && has['z'] && !this.configuration.hasCube([x, y - 1, z - 1]) && this.nbrInComponent([x, y - 1, z - 1], componentPositions)) return [x, y - 1, z - 1];
        if (has['y'] && has['Z'] && !this.configuration.hasCube([x, y - 1, z + 1]) && this.nbrInComponent([x, y - 1, z + 1], componentPositions)) return [x, y - 1, z + 1];
        if (has['Y'] && has['z'] && !this.configuration.hasCube([x, y + 1, z - 1]) && this.nbrInComponent([x, y + 1, z - 1], componentPositions)) return [x, y + 1, z - 1];
        if (has['Y'] && has['Z'] && !this.configuration.hasCube([x, y + 1, z + 1]) && this.nbrInComponent([x, y + 1, z + 1], componentPositions)) return [x, y + 1, z + 1];
        
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
     * Runs a series of moves to walk a leafCube Cube leafCube over the boundary of
     * the configuration to end up at the given empty target cell.
     * It tries to find a shortest path over only the Cubes
     * contributing to the capacity of the corresponding light cube lightCube.
     * One of three situations might occur:
     * * This path exists and is also valid when considering the complete configuration:
     *      In this case, just follow this path
     * * This path exists, but is not valid when considering the complete configuration:
     *      The path is blocked by a cube not in the capacity of lightCube.
     *      Just move as far along the path as possible.
     *      This closes a cycle that contains lightCube, which makes lightCube not light anymore.
     * * This path does not exist.
     *      In this case, cube leafCube is blocked by its own ancestors.
     *      Move leafCube to a position that closes a cycle, such that we can make progress.
     */
    *walkBoundaryUntil(leafCube: Cube, lightCube: Cube, root: Cube, target: [number, number, number]): MoveGenerator {
        // create a new configuration containing only light square lightCube and its descendants.
        let lightSquareDescendants = new Configuration();
        let capacityCubes = this.configuration.capacityCubes(lightCube, root);
        for (let i = 0; i < capacityCubes.length; i++) {
            if (capacityCubes[i]) {
                lightSquareDescendants.addCube(new Cube(null, this.configuration.cubes[i].p));
            }
        }
        lightSquareDescendants.addCube(new Cube(null, lightCube.p));
        
        // compute path in descendants of lightCube.
        // set the configuration to be the original configuration instead of the "dummy" configuration.
        let pathDescendants = lightSquareDescendants.shortestMovePath(leafCube.p, target);
        pathDescendants.forEach(m => {
           m.configuration = this.configuration;
        });
        
        let pathComplete = this.configuration.shortestMovePath(leafCube.p, target);

        if (pathDescendants.length === 0) {
            // no path in the descendants possible (case 3)
            // TODO
        } else {
            let samePath = true;
            if (pathComplete.length !== pathDescendants.length) {
                samePath = false;
            } else {
                for (let i = 0; i < pathComplete.length; i++) {
                    if (pathComplete[i] !== pathDescendants[i]) {
                        samePath = false;
                    }
                }
            }
            if (!samePath) {
                // The two paths are not the same, so we must be blocked somewhere
                // go as far on the descendants path as is possible (case 2)
                for (let m of pathDescendants) {
                    if (m.isValid()) {
                        yield m;
                    } else {
                        break;
                    }
                }
            } else {
                // both paths are possible, just execute this path (case 1)
                yield* pathDescendants;
            }
        }
    }
    
}

export { GatherAlgorithm }